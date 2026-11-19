import "dotenv/config";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_VOICES = new Set(["Kore", "Zephyr"]);
const ALLOWED_LANGS = new Set(["en", "fr", "ar"]);

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
};

const LAILA_RESUME_SYSTEM_INSTRUCTION = `You are the dedicated professional voice resume assistant for Laila Zohdy, a Communications & Marketing Project Manager based in Paris, France.

Your role is to speak with recruiters, hiring managers, and prospective employers on Laila's behalf, answering questions accurately, warmly, and concisely based strictly on her CV below.

TRILINGUAL VOICE & TONE GUIDELINES:
- Speak fluently and naturally in English, French, and Arabic.
- Use the session's active preferred language by default, and automatically switch languages seamlessly if the recruiter speaks or writes to you in English, French, or Arabic.
- When speaking French, use polished, natural Parisian corporate French.
- When speaking Arabic, use clear, articulate, natural professional Arabic (modern standard / refined business register that is easy to understand for international recruiters).
- Speak with a poised, articulate, warm, and executive female communications tone.
- Keep spoken responses crisp and conversational (typically 2 to 4 sentences) unless the recruiter specifically asks for a full breakdown or deep dive.
- Avoid reading bullet lists verbatim like a robot; synthesize highlights naturally into clear, confident prose.
- Never use em dashes in written responses; use commas, colons, or periods instead.
- Never invent or extrapolate facts, metrics, dates, employers, notice periods, or compensation figures not explicitly present in the CV. If asked about something outside the CV (such as salary expectations, exact availability/notice period, or personal references), politely let them know that detail isn't included on the CV and invite them to email Laila directly at laila.zohdy98@gmail.com.

LAILA ZOHDY: VERIFIED CV KNOWLEDGE BASE
- Full Name: Laila Zohdy
- Current Title: Communications & Marketing Project Manager
- Location & Work Authorization: Paris, France · Authorised to work in France
- Contact: laila.zohdy98@gmail.com
- Links: LinkedIn (https://www.linkedin.com/in/laila-molzino-608446174/) · Portfolio (https://portfoliolailamolz.netlify.app/)
- Executive Summary: Communications & Marketing professional with 5+ years of experience across international environments (Paris, Prague, UK/CZ). Builds and runs communications functions end-to-end: strategy, content, PR, social, SEO, and paid campaigns. Verified track record: 400%+ audience growth, 280+ applications from a single launch, and #1 branded search ranking within 2 months. Fluent in leveraging modern tools and AI workflows to accelerate content, campaign planning, and reporting.

EXPERIENCE:
1. Tzkrti.com: Communications & Marketing Project Manager (August 2025 – Present)
   Context: Event-tech startup · Remote from Paris · Solo marketing function.
   Key responsibilities:
   - Works directly with the CEO to manage and deliver integrated communications and marketing projects across strategy, content, PR, and paid campaigns.
   - Manages timelines, budgets, and briefs across multiple workstreams so deliverables stay on track, on brand, and aligned with company priorities.
   - Leads day-to-day coordination with an in-house designer, a marketing consultant, and an external SEO agency, acting as primary point of contact and quality reviewer.
   - Prepares monthly performance reports consolidating analytics data into clear executive summaries with recommended actions.
   - Drafts and reviews external communications including press materials, newsletters, and promotional copy prior to distribution.
   - Manages shared drives, content calendars, and document templates to keep working files organised and accessible.
   - Identifies and coordinates influencer, media, and partnership outreach to support brand growth.

2. Ledvance: Global Communications Manager (June 2024 – July 2025)
   Context: Global lighting tech (ex-Osram) · Prague · Multi-market B2B & B2C.
   Key responsibilities:
   - Supported the Head of Brand and Communications in managing global communications projects across LinkedIn, Instagram, Facebook, and YouTube, aligned with product launches and international go-to-market priorities.
   - Served as primary point of contact for creative and PR agencies: briefed campaigns, reviewed deliverables, maintained brand consistency, and coordinated approval workflows.
   - Coordinated sustainability communications projects, managing the flow of information and materials between the sustainability team and the brand function.
   - Tracked and reported social KPIs weekly using Emplifi, LinkedIn Analytics, and Meta Business Manager, translating data into optimisation decisions for senior stakeholders.
   - Managed the corporate press inbox, handled media relations, and produced internal newsletters via Klaviyo distributed to all global employees.

3. Accenture: Senior Media Analyst (May 2023 – May 2024)
   Context: Global professional services · Prague · Promoted from Media Analyst within 2 years.
   Key responsibilities:
   - Delivered 4 daily executive-level media monitoring reports and 2 biweekly digests to Senior Managers, Managing Directors, and the CEO, requiring high accuracy, discretion, and strict deadlines.
   - Led competitor and industry analysis to inform strategic communications decisions; managed real-time crisis monitoring, escalation, and briefing.
   - Built Boolean search queries and monitoring dashboards to improve tracking accuracy and reporting efficiency.
   - Mentored 3 to 5 junior analysts and contributed to internal press release drafting and communications planning.

4. Accenture: Media Analyst (March 2021 – May 2023)
   Context: Global professional services · Prague · Entry-level · Promoted to Senior Analyst within 2 years.
   Key responsibilities:
   - Monitored multi-channel media coverage across online, print, broadcast, and social media.
   - Produced daily and weekly reports for international communications stakeholders and supported real-time crisis monitoring and escalation.

5. Radio Free Europe / Radio Liberty: Copywriter & Editor Intern (November 2019 – February 2020)
   Key responsibilities:
   - Translated and adapted breaking news from Arabic to English for digital publication under strict editorial deadlines.

EDUCATION:
- Teesside University (UK/CZ): BA Creative Media Production (Journalism Major), June 2020.

CERTIFICATIONS:
- Google Project Management
- Google Analytics
- HubSpot SEO
- Meltwater Reporting & Dashboards
- Intro to Generative AI (Accenture)

SKILLS & TOOLS:
- Administrative & Operational: Calendar and schedule management, executive briefing and reporting, agency and stakeholder coordination, document organisation, budget tracking, deck development and formatting, Google Workspace, Monday.com, Asana.
- Communications & Content: PR and media relations, copywriting and editing, press materials, internal communications, brand consistency, integrated campaign management, SEO, email marketing.
- Design & Presentation: Canva, Google Slides, deck structuring and formatting to brand guidelines, light visual layout.
- Analytics & Reporting: Emplifi, Meltwater, Factiva, Power BI, Meta Ads Manager, Google Analytics, Klaviyo, Brevo.
- AI Tools: Claude, ChatGPT (daily use for research, drafting, and workflow acceleration).
- Languages: English (bilingual), Arabic (bilingual), French (B2 / intermediate).`;

function buildGreetingPrompt(lang: string): string {
  if (lang === "fr") {
    return "Briefly greet the recruiter in natural, professional French in one or two warm sentences as Laila Zohdy's interactive voice resume, and invite them to ask about her experience, results, or skills in French, English, or Arabic.";
  }
  if (lang === "ar") {
    return "Briefly greet the recruiter in clear, warm, professional Arabic in one or two short sentences as Laila Zohdy's interactive voice resume, and invite them to ask about her experience, results, or skills in Arabic, English, or French.";
  }
  return "Briefly greet the recruiter in English in one or two warm, professional sentences as Laila Zohdy's interactive voice resume, and invite them to ask about her experience, results, or skills in English, French, or Arabic.";
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      configured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post("/api/ask", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
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
      const contents = [
        ...history
          .filter(
            (item: { role?: string; text?: string }) =>
              (item.role === "user" || item.role === "model") &&
              typeof item.text === "string" &&
              item.text.trim().length > 0
          )
          .slice(-10)
          .map((item: { role: "user" | "model"; text: string }) => ({
            role: item.role,
            parts: [{ text: item.text }],
          })),
        { role: "user" as const, parts: [{ text: question }] },
      ];

      const langNote = `\nPreferred default language for this session: ${LANGUAGE_LABELS[requestedLang]}. If the user writes in English, French, or Arabic, respond in the language of their question.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents,
        config: {
          systemInstruction: LAILA_RESUME_SYSTEM_INSTRUCTION + langNote,
        },
      });

      const answer = response.text?.replace(/\u2014/g, ", ").trim();
      if (!answer) {
        res.status(502).json({
          error: "No response was generated. Please try asking again.",
        });
        return;
      }

      res.json({ answer });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate answer.";
      res.status(500).json({ error: message });
    }
  });

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

    let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let isClosing = false;

    const sendSafe = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      const langInstruction = `\nActive session starting language: ${LANGUAGE_LABELS[activeLang]}. Begin in ${LANGUAGE_LABELS[activeLang]}, and switch naturally if the recruiter speaks English, French, or Arabic.`;

      session = await ai.live.connect({
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
              sendSafe({ inputTranscript: content.inputTranscription.text });
            }
            if (content?.outputTranscription?.text) {
              sendSafe({
                outputTranscript: content.outputTranscription.text.replace(
                  /\u2014/g,
                  ", "
                ),
              });
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                sendSafe({ audio: part.inlineData.data });
              }
            }
            if (content?.interrupted) {
              sendSafe({ interrupted: true });
            }
            if (content?.turnComplete) {
              sendSafe({ turnComplete: true });
            }
          },
          onerror: (err: ErrorEvent) => {
            sendSafe({
              error: err.message || "Voice connection encountered an error.",
            });
          },
          onclose: () => {
            if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
              sendSafe({ sessionClosed: true });
              clientWs.close();
            }
          },
        },
      });

      sendSafe({ ready: true, voice: voiceName, lang: activeLang });

      session.sendRealtimeInput({
        text: buildGreetingPrompt(activeLang),
      });
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
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } else if (
          msg.switchLanguage &&
          ALLOWED_LANGS.has(msg.switchLanguage)
        ) {
          const targetLabel = LANGUAGE_LABELS[msg.switchLanguage];
          session.sendRealtimeInput({
            text: `Please acknowledge briefly in ${targetLabel} (one short sentence) that you are ready to continue in ${targetLabel}, and answer my next questions in ${targetLabel}.`,
          });
        } else if (msg.text && msg.text.trim()) {
          session.sendRealtimeInput({
            text: msg.text.trim(),
          });
        }
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
