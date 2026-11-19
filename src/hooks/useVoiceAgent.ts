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

  const cleanupAudioAndSocket = useCallback(() => {
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

    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    setUserLevel(0);
    setAgentLevel(0);
    setAgentSpeaking(false);
  }, [stopPlayback]);

  useEffect(() => {
    return () => {
      cleanupAudioAndSocket();
    };
  }, [cleanupAudioAndSocket]);

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

        const inputCtx = new AudioContext({ sampleRate: 16000 });
        const outputCtx = new AudioContext({ sampleRate: 24000 });
        await inputCtx.resume();
        await outputCtx.resume();

        const analyser = outputCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.connect(outputCtx.destination);

        inputCtxRef.current = inputCtx;
        outputCtxRef.current = outputCtx;
        analyserRef.current = analyser;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/live?voice=${encodeURIComponent(activeVoice)}&lang=${encodeURIComponent(activeLang)}`
        );
        wsRef.current = ws;

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

        ws.onopen = () => {
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          const silentGain = inputCtx.createGain();
          silentGain.gain.value = 0;

          source.connect(processor);
          processor.connect(silentGain);
          silentGain.connect(inputCtx.destination);

          processor.onaudioprocess = (event) => {
            if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) {
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
            const base64Audio = float32ToPcm16Base64(pcm16k);
            ws.send(JSON.stringify({ audio: base64Audio }));
          };
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as {
              ready?: boolean;
              audio?: string;
              inputTranscript?: string;
              outputTranscript?: string;
              turnComplete?: boolean;
              interrupted?: boolean;
              error?: string;
              sessionClosed?: boolean;
            };

            if (msg.ready) {
              setStatus("connected");
            }
            if (msg.error) {
              setErrorMessage(msg.error);
              setStatus("error");
              cleanupAudioAndSocket();
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
              appendTranscriptDelta("agent", msg.outputTranscript);
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
              cleanupAudioAndSocket();
            }
          } catch {
            // Ignore unparseable messages
          }
        };

        ws.onerror = () => {
          setErrorMessage(
            "Unable to establish the real-time voice connection. Please verify microphone access or try text mode."
          );
          setStatus("error");
          cleanupAudioAndSocket();
        };

        ws.onclose = () => {
          finalizeStreamingTurn();
          if (statusRef.current !== "error") {
            setStatus("idle");
          }
          cleanupAudioAndSocket();
        };
      } catch (err) {
        const message =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Microphone permission was declined. Please allow microphone access to speak, or ask a question in writing below."
            : err instanceof Error
              ? err.message
              : "Could not access your microphone.";
        setErrorMessage(message);
        setStatus("error");
        cleanupAudioAndSocket();
      }
    },
    [
      appendTranscriptDelta,
      cleanupAudioAndSocket,
      finalizeStreamingTurn,
      playAudioChunk,
      stopPlayback,
      voiceName,
    ]
  );

  const stopSession = useCallback(() => {
    finalizeStreamingTurn();
    setStatus("idle");
    cleanupAudioAndSocket();
  }, [cleanupAudioAndSocket, finalizeStreamingTurn]);

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

  const changeLanguage = useCallback((nextLang: VoiceLanguage) => {
    setLanguage(nextLang);
    languageRef.current = nextLang;
    if (
      statusRef.current === "connected" &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(JSON.stringify({ switchLanguage: nextLang }));
    }
  }, []);

  const askQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      setErrorMessage(null);

      if (
        statusRef.current === "connected" &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
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
        wsRef.current.send(JSON.stringify({ text: trimmed }));
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

        const data = (await res.json()) as { answer?: string; error?: string };
        if (!res.ok || !data.answer) {
          throw new Error(data.error || "Unable to retrieve an answer right now.");
        }

        setTranscript((prev) => [
          ...prev,
          {
            id: `${Date.now()}-a`,
            role: "agent",
            text: data.answer!,
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
    [finalizeStreamingTurn]
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
