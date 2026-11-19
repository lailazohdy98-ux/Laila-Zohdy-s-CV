import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceLanguage } from "../data/resumeData";

export type VoiceStatus = "idle" | "connecting" | "connected" | "error";
export type VoicePersona = "Kore" | "Zephyr";

export interface TranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  mode: "voice" | "text";
  isStreaming?: boolean;
}

interface LiveServerEvent {
  ready?: boolean;
  audio?: string;
  inputTranscript?: string;
  outputTranscript?: string;
  turnComplete?: boolean;
  interrupted?: boolean;
  error?: string;
  sessionClosed?: boolean;
}

interface GeminiBidiMessage {
  setupComplete?: Record<string, unknown>;
  error?: { message?: string; code?: number };
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
        text?: string;
      }>;
    };
  };
}

const LANGUAGE_LABELS: Record<VoiceLanguage, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
};

async function readJsonSafe<T>(
  res: Response
): Promise<{ ok: boolean; status: number; data: T | null; rawText: string }> {
  const rawText = await res.text();
  try {
    const data = JSON.parse(rawText) as T;
    return { ok: res.ok, status: res.status, data, rawText };
  } catch {
    return { ok: false, status: res.status, data: null, rawText };
  }
}

async function decodeWsPayload(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return await data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  return "";
}

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(idx0 + 1, input.length - 1);
    const frac = srcIdx - idx0;
    output[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
  }
  return output;
}

function concatFloat32Arrays(chunks: Float32Array[]): Float32Array {
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [voiceName, setVoiceName] = useState<VoicePersona>("Kore");
  const [language, setLanguage] = useState<VoiceLanguage>("en");
  const [isMuted, setIsMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTextThinking, setIsTextThinking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const wsReadyRef = useRef(false);
  const micStreamReadyRef = useRef(false);
  const micEnableTimerRef = useRef<number | null>(null);
  const wsMessageQueueRef = useRef<Promise<void>>(Promise.resolve());
  const httpSessionIdRef = useRef<string | null>(null);
  const httpAbortRef = useRef<AbortController | null>(null);
  const transportModeRef = useRef<"gemini-ws" | "http" | null>(null);
  const pendingPcmChunksRef = useRef<Float32Array[]>([]);
  const httpFlushInFlightRef = useRef(false);

  const isMutedRef = useRef(false);
  const statusRef = useRef<VoiceStatus>("idle");
  const languageRef = useRef<VoiceLanguage>("en");
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const animFrameRef = useRef<number | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const stopPlayback = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setAgentSpeaking(false);
    setAgentLevel(0);
  }, []);

  const cleanupAudioAndTransport = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    stopPlayback();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      } catch {
        // Ignore disconnect errors
      }
      processorRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }

    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
      analyserRef.current = null;
    }

    wsReadyRef.current = false;
    micStreamReadyRef.current = false;
    if (micEnableTimerRef.current !== null) {
      window.clearTimeout(micEnableTimerRef.current);
      micEnableTimerRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    if (httpAbortRef.current) {
      httpAbortRef.current.abort();
      httpAbortRef.current = null;
    }

    if (httpSessionIdRef.current) {
      const sid = httpSessionIdRef.current;
      httpSessionIdRef.current = null;
      fetch(`/api/live/stop/${encodeURIComponent(sid)}`, {
        method: "POST",
      }).catch(() => {});
    }

    transportModeRef.current = null;
    pendingPcmChunksRef.current = [];
    httpFlushInFlightRef.current = false;

    setUserLevel(0);
    setAgentLevel(0);
    setAgentSpeaking(false);
  }, [stopPlayback]);

  useEffect(() => {
    return () => {
      cleanupAudioAndTransport();
    };
  }, [cleanupAudioAndTransport]);

  const appendTranscriptDelta = useCallback(
    (role: "user" | "agent", delta: string) => {
      if (!delta) return;
      setTranscript((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === role && last.isStreaming) {
          next[next.length - 1] = {
            ...last,
            text: last.text + delta,
          };
          return next;
        }
        if (last && last.isStreaming) {
          next[next.length - 1] = { ...last, isStreaming: false };
        }
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role,
          text: delta.trimStart(),
          mode: "voice",
          isStreaming: true,
        });
        return next;
      });
    },
    []
  );

  const finalizeStreamingTurn = useCallback(() => {
    setTranscript((prev) =>
      prev.map((entry) =>
        entry.isStreaming ? { ...entry, isStreaming: false } : entry
      )
    );
  }, []);

  const playAudioChunk = useCallback((base64Audio: string) => {
    const ctx = outputCtxRef.current;
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const float32 = base64Pcm16ToFloat32(base64Audio);
    if (float32.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    setAgentSpeaking(true);

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setAgentSpeaking(false);
        setAgentLevel(0);
      }
    };
  }, []);

  const handleServerEvent = useCallback(
    (msg: LiveServerEvent) => {
      if (msg.ready) {
        setStatus("connected");
      }
      if (msg.error) {
        setErrorMessage(msg.error);
        setStatus("error");
        cleanupAudioAndTransport();
        return;
      }
      if (msg.interrupted) {
        stopPlayback();
        finalizeStreamingTurn();
      }
      if (msg.inputTranscript) {
        appendTranscriptDelta("user", msg.inputTranscript);
      }
      if (msg.outputTranscript) {
        appendTranscriptDelta(
          "agent",
          msg.outputTranscript.replace(/\u2014/g, ", ")
        );
      }
      if (msg.audio) {
        playAudioChunk(msg.audio);
      }
      if (msg.turnComplete) {
        finalizeStreamingTurn();
      }
      if (msg.sessionClosed) {
        finalizeStreamingTurn();
        setStatus("idle");
        cleanupAudioAndTransport();
      }
    },
    [
      appendTranscriptDelta,
      cleanupAudioAndTransport,
      finalizeStreamingTurn,
      playAudioChunk,
      stopPlayback,
    ]
  );

  const flushHttpAudio = useCallback(async () => {
    if (
      httpFlushInFlightRef.current ||
      transportModeRef.current !== "http" ||
      !httpSessionIdRef.current ||
      pendingPcmChunksRef.current.length === 0
    ) {
      return;
    }

    httpFlushInFlightRef.current = true;
    try {
      while (
        transportModeRef.current === "http" &&
        httpSessionIdRef.current &&
        pendingPcmChunksRef.current.length > 0
      ) {
        const chunks = pendingPcmChunksRef.current;
        pendingPcmChunksRef.current = [];
        const merged = concatFloat32Arrays(chunks);
        const base64Audio = float32ToPcm16Base64(merged);
        const sid = httpSessionIdRef.current;
        if (!sid) break;

        await fetch(`/api/live/input/${encodeURIComponent(sid)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64Audio }),
        });
      }
    } catch {
      // Transport closed or interrupted
    } finally {
      httpFlushInFlightRef.current = false;
    }
  }, []);

  const sendControlPayload = useCallback(
    async (payload: { text?: string; switchLanguage?: VoiceLanguage }) => {
      const promptText = payload.switchLanguage
        ? `Please acknowledge briefly in ${LANGUAGE_LABELS[payload.switchLanguage]} (one short sentence) that you are ready to continue in ${LANGUAGE_LABELS[payload.switchLanguage]}, and answer my next questions in ${LANGUAGE_LABELS[payload.switchLanguage]}.`
        : payload.text?.trim();

      if (!promptText) return;

      if (
        transportModeRef.current === "gemini-ws" &&
        wsReadyRef.current &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        micStreamReadyRef.current = false;
        wsRef.current.send(
          JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: promptText }] }],
              turnComplete: true,
            },
          })
        );
        if (micEnableTimerRef.current !== null) {
          window.clearTimeout(micEnableTimerRef.current);
        }
        micEnableTimerRef.current = window.setTimeout(() => {
          micStreamReadyRef.current = true;
          micEnableTimerRef.current = null;
        }, 450);
        return;
      }

      if (transportModeRef.current === "http" && httpSessionIdRef.current) {
        await fetch(
          `/api/live/input/${encodeURIComponent(httpSessionIdRef.current)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      }
    },
    []
  );

  const startHttpFallbackSession = useCallback(
    async (activeVoice: VoicePersona, activeLang: VoiceLanguage) => {
      const startRes = await fetch("/api/live/start", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: activeVoice, lang: activeLang }),
      });
      const parsed = await readJsonSafe<{ sessionId?: string; error?: string }>(
        startRes
      );

      if (!parsed.ok || !parsed.data?.sessionId) {
        throw new Error(
          parsed.data?.error ||
            "Unable to establish the real-time voice connection right now. Please try written questions below."
        );
      }

      const sessionId = parsed.data.sessionId;
      if (statusRef.current === "idle") {
        fetch(`/api/live/stop/${encodeURIComponent(sessionId)}`, {
          method: "POST",
        }).catch(() => {});
        return;
      }

      httpSessionIdRef.current = sessionId;
      transportModeRef.current = "http";

      const abortController = new AbortController();
      httpAbortRef.current = abortController;
      setStatus("connected");

      void (async () => {
        try {
          const streamRes = await fetch(
            `/api/live/stream/${encodeURIComponent(sessionId)}`,
            {
              headers: { Accept: "text/event-stream" },
              signal: abortController.signal,
            }
          );

          if (!streamRes.ok || !streamRes.body) {
            throw new Error("Voice audio stream interrupted.");
          }

          const reader = streamRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";

            for (const block of events) {
              for (const line of block.split("\n")) {
                if (line.startsWith("data:")) {
                  const jsonStr = line.slice(5).trim();
                  if (!jsonStr) continue;
                  try {
                    const msg = JSON.parse(jsonStr) as LiveServerEvent;
                    handleServerEvent(msg);
                  } catch {
                    // Ignore malformed SSE lines
                  }
                }
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          if (
            statusRef.current === "connected" ||
            statusRef.current === "connecting"
          ) {
            setErrorMessage(
              err instanceof Error
                ? err.message
                : "Voice stream disconnected unexpectedly."
            );
            setStatus("error");
            cleanupAudioAndTransport();
          }
        }
      })();
    },
    [cleanupAudioAndTransport, handleServerEvent]
  );

  const connectWithEphemeralToken = useCallback(
    async (activeVoice: VoicePersona, activeLang: VoiceLanguage) => {
      const tokenRes = await fetch("/api/live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: activeVoice, lang: activeLang }),
      });

      const parsed = await readJsonSafe<{
        token?: string;
        greetingPrompt?: string;
        error?: string;
      }>(tokenRes);

      if (!parsed.ok || !parsed.data?.token) {
        const rawSnippet =
          !parsed.data && parsed.rawText
            ? `: ${parsed.rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)}`
            : "";
        const detail =
          parsed.data?.error ||
          `Unable to initialize the voice session (HTTP ${parsed.status}${rawSnippet}).`;
        throw new Error(detail);
      }

      if (statusRef.current === "idle") {
        return;
      }

      const { token, greetingPrompt } = parsed.data;
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;

      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        wsReadyRef.current = false;
        let settled = false;

        ws.onopen = () => {
          transportModeRef.current = "gemini-ws";
          ws.send(
            JSON.stringify({
              setup: {
                model: "models/gemini-3.8-live",
              },
            })
          );
        };

        ws.onmessage = (event) => {
          wsMessageQueueRef.current = wsMessageQueueRef.current.then(async () => {
            try {
              const rawText = await decodeWsPayload(event.data);
              if (!rawText) return;
              const msg = JSON.parse(rawText) as GeminiBidiMessage;

              if (msg.error) {
                const errText =
                  msg.error.message || "Voice connection encountered an error.";
                if (!settled) {
                  settled = true;
                  reject(new Error(errText));
                  return;
                }
                handleServerEvent({ error: errText });
                return;
              }

              if (msg.setupComplete) {
                wsReadyRef.current = true;
                setStatus("connected");
                if (greetingPrompt && ws.readyState === WebSocket.OPEN) {
                  micStreamReadyRef.current = false;
                  ws.send(
                    JSON.stringify({
                      clientContent: {
                        turns: [
                          { role: "user", parts: [{ text: greetingPrompt }] },
                        ],
                        turnComplete: true,
                      },
                    })
                  );
                  if (micEnableTimerRef.current !== null) {
                    window.clearTimeout(micEnableTimerRef.current);
                  }
                  micEnableTimerRef.current = window.setTimeout(() => {
                    micStreamReadyRef.current = true;
                    micEnableTimerRef.current = null;
                  }, 700);
                } else {
                  micStreamReadyRef.current = true;
                }
                if (!settled) {
                  settled = true;
                  resolve();
                }
              }

              const content = msg.serverContent;
              if (!content) return;

              if (content.interrupted) {
                handleServerEvent({ interrupted: true });
              }
              if (content.inputTranscription?.text) {
                handleServerEvent({
                  inputTranscript: content.inputTranscription.text,
                });
              }
              if (content.outputTranscription?.text) {
                handleServerEvent({
                  outputTranscript: content.outputTranscription.text,
                });
              }
              for (const part of content.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  handleServerEvent({ audio: part.inlineData.data });
                }
              }
              if (content.turnComplete) {
                handleServerEvent({ turnComplete: true });
              }
            } catch {
              // Ignore unparseable frames
            }
          });
        };

        ws.onerror = () => {
          if (!settled) {
            settled = true;
            reject(
              new Error("Unable to establish the real-time voice WebSocket.")
            );
          } else if (wsRef.current === ws && statusRef.current === "connected") {
            setErrorMessage(
              "The voice connection was interrupted. Please start a new session or use written questions below."
            );
            setStatus("error");
            cleanupAudioAndTransport();
          }
        };

        ws.onclose = (closeEvent) => {
          wsReadyRef.current = false;
          if (!settled) {
            settled = true;
            const reason = closeEvent.reason
              ? `: ${closeEvent.reason}`
              : "";
            reject(
              new Error(`Voice connection closed before ready${reason}.`)
            );
            return;
          }
          if (wsRef.current === ws) {
            finalizeStreamingTurn();
            if (statusRef.current !== "error") {
              setStatus("idle");
            }
            cleanupAudioAndTransport();
          }
        };
      });
    },
    [cleanupAudioAndTransport, finalizeStreamingTurn, handleServerEvent]
  );

  const startSession = useCallback(
    async (selectedVoice?: VoicePersona, selectedLang?: VoiceLanguage) => {
      const activeVoice = selectedVoice ?? voiceName;
      const activeLang = selectedLang ?? languageRef.current;
      if (statusRef.current === "connecting" || statusRef.current === "connected") {
        return;
      }

      setErrorMessage(null);
      setStatus("connecting");
      isMutedRef.current = false;
      setIsMuted(false);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        let inputCtx: AudioContext;
        try {
          inputCtx = new AudioContext({ sampleRate: 16000 });
        } catch {
          inputCtx = new AudioContext();
        }
        let outputCtx: AudioContext;
        try {
          outputCtx = new AudioContext({ sampleRate: 24000 });
        } catch {
          outputCtx = new AudioContext();
        }
        await inputCtx.resume();
        await outputCtx.resume();

        const analyser = outputCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.connect(outputCtx.destination);

        inputCtxRef.current = inputCtx;
        outputCtxRef.current = outputCtx;
        analyserRef.current = analyser;

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        const silentGain = inputCtx.createGain();
        silentGain.gain.value = 0;

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(inputCtx.destination);

        processor.onaudioprocess = (event) => {
          if (isMutedRef.current) {
            setUserLevel(0);
            return;
          }
          const rawChannel = event.inputBuffer.getChannelData(0);
          let sumSq = 0;
          for (let i = 0; i < rawChannel.length; i++) {
            sumSq += rawChannel[i] * rawChannel[i];
          }
          const rms = Math.sqrt(sumSq / rawChannel.length);
          setUserLevel(Math.min(1, rms * 5.5));

          const pcm16k = downsampleTo16k(rawChannel, inputCtx.sampleRate);

          if (
            transportModeRef.current === "gemini-ws" &&
            wsReadyRef.current &&
            micStreamReadyRef.current &&
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN
          ) {
            const base64Audio = float32ToPcm16Base64(pcm16k);
            wsRef.current.send(
              JSON.stringify({
                realtimeInput: {
                  audio: {
                    data: base64Audio,
                    mimeType: "audio/pcm;rate=16000",
                  },
                },
              })
            );
          } else if (
            transportModeRef.current === "http" &&
            httpSessionIdRef.current
          ) {
            pendingPcmChunksRef.current.push(new Float32Array(pcm16k));
            void flushHttpAudio();
          }
        };

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (analyserRef.current && activeSourcesRef.current.size > 0) {
            analyserRef.current.getByteFrequencyData(freqData);
            let sum = 0;
            for (let i = 0; i < freqData.length; i++) {
              sum += freqData[i];
            }
            const avg = sum / (freqData.length * 255);
            setAgentLevel(Math.min(1, avg * 2.2));
          } else {
            setAgentLevel(0);
          }
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        animFrameRef.current = requestAnimationFrame(updateMeter);

        try {
          await connectWithEphemeralToken(activeVoice, activeLang);
        } catch (tokenErr) {
          const errMsg =
            tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
          const isConfigError =
            errMsg.includes("GEMINI_API_KEY") ||
            errMsg.includes("not configured");
          if (isConfigError) {
            throw tokenErr;
          }
          // Try Express HTTP SSE fallback when running on Node server
          try {
            await startHttpFallbackSession(activeVoice, activeLang);
          } catch {
            throw tokenErr;
          }
        }
      } catch (err) {
        const message =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Microphone permission was declined. Please allow microphone access to speak, or ask a question in writing below."
            : err instanceof Error
              ? err.message
              : "Could not start the voice session.";
        setErrorMessage(message);
        setStatus("error");
        cleanupAudioAndTransport();
      }
    },
    [
      cleanupAudioAndTransport,
      connectWithEphemeralToken,
      flushHttpAudio,
      startHttpFallbackSession,
      voiceName,
    ]
  );

  const stopSession = useCallback(() => {
    finalizeStreamingTurn();
    setStatus("idle");
    cleanupAudioAndTransport();
  }, [cleanupAudioAndTransport, finalizeStreamingTurn]);

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);
    if (next) setUserLevel(0);
  }, []);

  const changeVoice = useCallback(
    (nextVoice: VoicePersona) => {
      setVoiceName(nextVoice);
      if (statusRef.current === "connected") {
        stopSession();
      }
    },
    [stopSession]
  );

  const changeLanguage = useCallback(
    (nextLang: VoiceLanguage) => {
      setLanguage(nextLang);
      languageRef.current = nextLang;
      if (statusRef.current === "connected") {
        void sendControlPayload({ switchLanguage: nextLang });
      }
    },
    [sendControlPayload]
  );

  const askQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      setErrorMessage(null);

      if (statusRef.current === "connected" && transportModeRef.current) {
        finalizeStreamingTurn();
        setTranscript((prev) => [
          ...prev,
          {
            id: `${Date.now()}-u`,
            role: "user",
            text: trimmed,
            mode: "text",
          },
        ]);
        await sendControlPayload({ text: trimmed });
        return;
      }

      setTranscript((prev) => [
        ...prev,
        {
          id: `${Date.now()}-u`,
          role: "user",
          text: trimmed,
          mode: "text",
        },
      ]);
      setIsTextThinking(true);

      try {
        const history = transcriptRef.current.map((entry) => ({
          role: entry.role === "user" ? "user" : "model",
          text: entry.text,
        }));

        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            history,
            language: languageRef.current,
          }),
        });

        const parsed = await readJsonSafe<{ answer?: string; error?: string }>(
          res
        );
        const answer = parsed.data?.answer;
        if (!parsed.ok || !answer) {
          throw new Error(
            parsed.data?.error ||
              "Unable to reach the assistant right now. Please try again in a moment."
          );
        }

        setTranscript((prev) => [
          ...prev,
          {
            id: `${Date.now()}-a`,
            role: "agent",
            text: answer,
            mode: "text",
          },
        ]);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Something went wrong while answering your question.";
        setErrorMessage(msg);
      } finally {
        setIsTextThinking(false);
      }
    },
    [finalizeStreamingTurn, sendControlPayload]
  );

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setErrorMessage(null);
  }, []);

  return {
    status,
    voiceName,
    language,
    isMuted,
    agentSpeaking,
    userLevel,
    agentLevel,
    transcript,
    errorMessage,
    isTextThinking,
    startSession,
    stopSession,
    toggleMute,
    changeVoice,
    changeLanguage,
    askQuestion,
    clearTranscript,
  };
}
