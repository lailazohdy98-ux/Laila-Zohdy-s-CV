import "dotenv/config";
import crypto from "crypto";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import {
  ALLOWED_LANGS,
  ALLOWED_VOICES,
  LANGUAGE_LABELS,
  LAILA_RESUME_SYSTEM_INSTRUCTION,
  buildGreetingPrompt,
  generateResumeAnswer,
  mintLiveVoiceToken,
} from "./shared/resumeAssistant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: "v1beta",
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

type LiveSession = Awaited<ReturnType<GoogleGenAI["live"]["connect"]>>;

interface HttpLiveBridge {
  id: string;
  session: LiveSession | null;
  queue: string[];
  listeners: Set<(serialized: string) => void>;
  closed: boolean;
  lastActivity: number;
}

const httpLiveSessions = new Map<string, HttpLiveBridge>();

function emitHttpBridgeEvent(
  bridge: HttpLiveBridge,
  payload: Record<string, unknown>
) {
  if (bridge.closed) return;
  const serialized = JSON.stringify(payload);
  bridge.lastActivity = Date.now();
  if (bridge.listeners.size > 0) {
    for (const listener of bridge.listeners) {
      listener(serialized);
    }
  } else {
    bridge.queue.push(serialized);
    if (bridge.queue.length > 500) {
      bridge.queue.shift();
    }
  }
}

function closeHttpBridge(sessionId: string) {
  const bridge = httpLiveSessions.get(sessionId);
  if (!bridge) return;
  bridge.closed = true;
  bridge.listeners.clear();
  try {
    bridge.session?.close();
  } catch {
    // Ignore close errors
  }
  httpLiveSessions.delete(sessionId);
}

// Clean up stale HTTP live sessions every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, bridge] of httpLiveSessions.entries()) {
    if (now - bridge.lastActivity > 5 * 60 * 1000) {
      closeHttpBridge(id);
    }
  }
}, 60_000).unref();

async function openGeminiLiveSession(
  ai: GoogleGenAI,
  voiceName: string,
  activeLang: string,
  emit: (payload: Record<string, unknown>) => void,
  onUnexpectedClose: () => void
): Promise<LiveSession> {
  const langInstruction = `\nActive session starting language: ${LANGUAGE_LABELS[activeLang]}. Begin in ${LANGUAGE_LABELS[activeLang]}, and switch naturally if the recruiter speaks English, French, or Arabic.`;

  const session = await ai.live.connect({
    model: "gemini-3.8-live",
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: LAILA_RESUME_SYSTEM_INSTRUCTION + langInstruction,
    },
    callbacks: {
      onmessage: (message: LiveServerMessage) => {
        const content = message.serverContent;
        if (content?.inputTranscription?.text) {
          emit({ inputTranscript: content.inputTranscription.text });
        }
        if (content?.outputTranscription?.text) {
          emit({
            outputTranscript: content.outputTranscription.text.replace(
              /\u2014/g,
              ", "
            ),
          });
        }
        for (const part of content?.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) {
            emit({ audio: part.inlineData.data });
          }
        }
        if (content?.interrupted) {
          emit({ interrupted: true });
        }
        if (content?.turnComplete) {
          emit({ turnComplete: true });
        }
      },
      onerror: (err: ErrorEvent) => {
        emit({
          error: err.message || "Voice connection encountered an error.",
        });
      },
      onclose: () => {
        onUnexpectedClose();
      },
    },
  });

  emit({ ready: true, voice: voiceName, lang: activeLang });

  session.sendRealtimeInput({
    text: buildGreetingPrompt(activeLang),
  });

  return session;
}

function forwardLiveInput(
  session: LiveSession,
  msg: { audio?: string; text?: string; switchLanguage?: string }
) {
  if (msg.audio) {
    session.sendRealtimeInput({
      audio: {
        data: msg.audio,
        mimeType: "audio/pcm;rate=16000",
      },
    });
  } else if (msg.switchLanguage && ALLOWED_LANGS.has(msg.switchLanguage)) {
    const targetLabel = LANGUAGE_LABELS[msg.switchLanguage];
    session.sendRealtimeInput({
      text: `Please acknowledge briefly in ${targetLabel} (one short sentence) that you are ready to continue in ${targetLabel}, and answer my next questions in ${targetLabel}.`,
    });
  } else if (msg.text && msg.text.trim()) {
    session.sendRealtimeInput({
      text: msg.text.trim(),
    });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      configured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post("/api/ask", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: "GEMINI_API_KEY is not configured on the server.",
      });
      return;
    }

    const question =
      typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const requestedLang =
      typeof req.body?.language === "string" &&
      ALLOWED_LANGS.has(req.body.language)
        ? req.body.language
        : "en";

    if (!question) {
      res.status(400).json({ error: "Please enter a question to ask." });
      return;
    }

    try {
      const answer = await generateResumeAnswer({
        apiKey,
        question,
        history,
        language: requestedLang,
      });
      res.json({ answer });
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Failed to generate answer.";
      const friendly =
        raw.includes("503") || raw.includes("UNAVAILABLE")
          ? "The text Q&A service is experiencing a temporary spike in demand. Please try again in a moment, or start a live voice interview."
          : raw;
      res.status(500).json({ error: friendly });
    }
  });

  // Ephemeral Live API token endpoint (enables Vercel / Netlify serverless deployments)
  app.post("/api/live-token", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: "GEMINI_API_KEY is not configured on the server.",
      });
      return;
    }

    try {
      const result = await mintLiveVoiceToken({
        apiKey,
        voice: req.body?.voice,
        lang: req.body?.lang,
      });
      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create voice token.";
      res.status(500).json({ error: message });
    }
  });

  // HTTP Streaming (SSE + POST) Live API endpoints (works behind iframe fetch bridges and proxies)
  app.post("/api/live/start", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: "GEMINI_API_KEY is not configured on the server.",
      });
      return;
    }

    const requestedVoice =
      typeof req.body?.voice === "string" ? req.body.voice : "Kore";
    const voiceName = ALLOWED_VOICES.has(requestedVoice)
      ? requestedVoice
      : "Kore";
    const requestedLang =
      typeof req.body?.lang === "string" ? req.body.lang : "en";
    const activeLang = ALLOWED_LANGS.has(requestedLang) ? requestedLang : "en";

    const sessionId = crypto.randomUUID();
    const bridge: HttpLiveBridge = {
      id: sessionId,
      session: null,
      queue: [],
      listeners: new Set(),
      closed: false,
      lastActivity: Date.now(),
    };
    httpLiveSessions.set(sessionId, bridge);

    try {
      bridge.session = await openGeminiLiveSession(
        ai,
        voiceName,
        activeLang,
        (payload) => emitHttpBridgeEvent(bridge, payload),
        () => {
          if (!bridge.closed) {
            emitHttpBridgeEvent(bridge, { sessionClosed: true });
            closeHttpBridge(sessionId);
          }
        }
      );

      res.json({ sessionId, voice: voiceName, lang: activeLang });
    } catch (err) {
      closeHttpBridge(sessionId);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to connect to the Live API voice service.";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/live/stream/:sessionId", (req, res) => {
    const bridge = httpLiveSessions.get(req.params.sessionId);
    if (!bridge || bridge.closed) {
      res.status(404).json({ error: "Voice session not found." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(": connected\n\n");

    const sendEvent = (serialized: string) => {
      if (!res.writableEnded) {
        res.write(`data: ${serialized}\n\n`);
      }
    };

    // Flush any queued messages (like ready + initial greeting audio)
    while (bridge.queue.length > 0) {
      const next = bridge.queue.shift();
      if (next) sendEvent(next);
    }

    bridge.listeners.add(sendEvent);

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": ping\n\n");
      }
    }, 15_000);

    req.on("close", () => {
      clearInterval(keepAlive);
      bridge.listeners.delete(sendEvent);
      closeHttpBridge(bridge.id);
    });
  });

  app.post("/api/live/input/:sessionId", (req, res) => {
    const bridge = httpLiveSessions.get(req.params.sessionId);
    if (!bridge || bridge.closed || !bridge.session) {
      res.status(404).json({ error: "Voice session is no longer active." });
      return;
    }

    bridge.lastActivity = Date.now();
    try {
      forwardLiveInput(bridge.session, req.body || {});
      res.json({ ok: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send audio input.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/live/stop/:sessionId", (req, res) => {
    closeHttpBridge(req.params.sessionId);
    res.json({ ok: true });
  });

  // WebSocket Live API bridge (direct low-latency transport when WS upgrades are permitted)
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const urlPath = (req.url || "").split("?")[0];
    if (urlPath === "/live") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs: WebSocket, req) => {
    const ai = getAiClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          error: "GEMINI_API_KEY is not configured on the server.",
        })
      );
      clientWs.close();
      return;
    }

    const requestUrl = new URL(req.url || "/live", `http://${req.headers.host}`);
    const requestedVoice = requestUrl.searchParams.get("voice") || "Kore";
    const voiceName = ALLOWED_VOICES.has(requestedVoice)
      ? requestedVoice
      : "Kore";
    const requestedLang = requestUrl.searchParams.get("lang") || "en";
    const activeLang = ALLOWED_LANGS.has(requestedLang) ? requestedLang : "en";

    let session: LiveSession | null = null;
    let isClosing = false;

    const sendSafe = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      session = await openGeminiLiveSession(
        ai,
        voiceName,
        activeLang,
        sendSafe,
        () => {
          if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
            sendSafe({ sessionClosed: true });
            clientWs.close();
          }
        }
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to connect to the Live API voice service.";
      sendSafe({ error: message });
      clientWs.close();
      return;
    }

    clientWs.on("message", (raw) => {
      if (!session) return;
      try {
        const msg = JSON.parse(raw.toString()) as {
          audio?: string;
          text?: string;
          switchLanguage?: string;
        };
        forwardLiveInput(session, msg);
      } catch {
        // Ignore malformed frames
      }
    });

    clientWs.on("close", () => {
      isClosing = true;
      try {
        session?.close();
      } catch {
        // Ignore close errors
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Application build not found. Run npm run build.");
      }
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
