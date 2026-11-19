import { FormEvent, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Send, Volume2 } from "lucide-react";
import {
  QUICK_RECRUITER_QUESTIONS_BY_LANG,
  VoiceLanguage,
} from "../data/resumeData";
import {
  TranscriptEntry,
  VoicePersona,
  VoiceStatus,
} from "../hooks/useVoiceAgent";

interface VoiceStudioProps {
  status: VoiceStatus;
  voiceName: VoicePersona;
  language: VoiceLanguage;
  isMuted: boolean;
  agentSpeaking: boolean;
  userLevel: number;
  agentLevel: number;
  transcript: TranscriptEntry[];
  errorMessage: string | null;
  isTextThinking: boolean;
  onStart: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  onChangeVoice: (voice: VoicePersona) => void;
  onChangeLanguage: (lang: VoiceLanguage) => void;
  onAskQuestion: (question: string) => void;
  onClearTranscript: () => void;
}

const LANGUAGE_OPTIONS: { code: VoiceLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

const PLACEHOLDER_BY_LANG: Record<VoiceLanguage, { idle: string; live: string }> = {
  en: {
    idle: "Ask a question in writing...",
    live: "Type a prompt to speak aloud...",
  },
  fr: {
    idle: "Posez une question par écrit...",
    live: "Saisissez une question à l'oral...",
  },
  ar: {
    idle: "اكتب سؤالك هنا...",
    live: "اكتب سؤالاً ليتم الرد عليه صوتياً...",
  },
};

export function VoiceStudio({
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
  onStart,
  onStop,
  onToggleMute,
  onChangeVoice,
  onChangeLanguage,
  onAskQuestion,
  onClearTranscript,
}: VoiceStudioProps) {
  const [questionInput, setQuestionInput] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, isTextThinking]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim()) return;
    onAskQuestion(questionInput);
    setQuestionInput("");
  };

  const activeAmplitude =
    status === "connected"
      ? agentSpeaking
        ? Math.max(0.15, agentLevel)
        : isMuted
          ? 0
          : userLevel
      : 0;

  const outerScale = 1 + activeAmplitude * 0.22;
  const innerScale = 1 + activeAmplitude * 0.12;

  const stateLabel =
    status === "connecting"
      ? "Establishing voice link..."
      : status === "connected"
        ? agentSpeaking
          ? "Speaking"
          : isMuted
            ? "Microphone muted"
            : "Listening"
        : isTextThinking
          ? "Drafting response..."
          : "Ready for your questions";

  const quickQuestions = QUICK_RECRUITER_QUESTIONS_BY_LANG[language];
  const inputPlaceholder =
    status === "connected"
      ? PLACEHOLDER_BY_LANG[language].live
      : PLACEHOLDER_BY_LANG[language].idle;

  return (
    <section
      id="voice-studio"
      aria-label="Interactive Voice Resume"
      className="flex h-full flex-col justify-between rounded-2xl border border-[#E6E0DA] bg-white p-6 md:p-7"
    >
      {/* Studio Header, Language Selector & Voice Persona Selector */}
      <div className="flex flex-col gap-3 border-b border-[#EFEAE5] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#6B4C5B]">
              Voice Resume Assistant
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[#1E1D20]">
              Laila&apos;s Career Representative
            </p>
          </div>

          <div
            role="group"
            aria-label="Conversation language"
            className="flex items-center gap-1 rounded-lg bg-[#F4F0EC] p-1"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => onChangeLanguage(opt.code)}
                className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  language === opt.code
                    ? "bg-white text-[#1E1D20] shadow-xs"
                    : "text-[#5E5A63] hover:text-[#1E1D20]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#6E6973]">Female voice tone</span>
          <div
            role="group"
            aria-label="Female voice tone"
            className="flex items-center gap-1 rounded-lg bg-[#F4F0EC] p-1"
          >
            <button
              type="button"
              onClick={() => onChangeVoice("Kore")}
              className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                voiceName === "Kore"
                  ? "bg-white text-[#1E1D20] shadow-xs"
                  : "text-[#5E5A63] hover:text-[#1E1D20]"
              }`}
            >
              Kore · Executive
            </button>
            <button
              type="button"
              onClick={() => onChangeVoice("Zephyr")}
              className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                voiceName === "Zephyr"
                  ? "bg-white text-[#1E1D20] shadow-xs"
                  : "text-[#5E5A63] hover:text-[#1E1D20]"
              }`}
            >
              Zephyr · Warm
            </button>
          </div>
        </div>
      </div>

      {/* Central Harmonic Voice Visualizer & Call Controls */}
      <div className="my-5 flex flex-col items-center justify-center rounded-xl bg-[#FAF8F6] px-5 py-6 text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div
            aria-hidden="true"
            style={{
              transform: `scale(${outerScale.toFixed(3)})`,
            }}
            className="absolute inset-0 rounded-full bg-[#E5EDE8] opacity-75 transition-transform duration-150 ease-out"
          />
          <div
            aria-hidden="true"
            style={{
              transform: `scale(${innerScale.toFixed(3)})`,
            }}
            className="absolute inset-3 rounded-full bg-[#F1E4E9] transition-transform duration-150 ease-out"
          />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[#DFD5D9] bg-white text-[#6B4C5B]">
            {status === "connected" && agentSpeaking ? (
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Mic className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-[#5E5A63]">
          {status === "connected" && (
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[#6B8F78]"
            />
          )}
          <span>{stateLabel}</span>
          <span aria-hidden="true">·</span>
          <span>EN / FR / AR</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {status === "connected" ? (
            <>
              <button
                type="button"
                onClick={onToggleMute}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-[#DCD5CE] bg-white px-4 py-2 text-xs font-semibold text-[#1E1D20] transition-colors duration-150 hover:bg-[#F5F1ED] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4C5B]"
              >
                {isMuted ? (
                  <>
                    <MicOff className="h-3.5 w-3.5 text-[#8A4A5A]" />
                    Unmute Mic
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-[#5D7B68]" />
                    Mute Mic
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#2E2A2D] px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#1E1D20] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4C5B]"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                End Session
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={status === "connecting"}
              onClick={onStart}
              className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#6B4C5B] px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#573C49] disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4C5B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F6]"
            >
              <Mic className="h-4 w-4" />
              {status === "connecting"
                ? "Connecting Voice..."
                : "Start Voice Interview"}
            </button>
          )}
        </div>

        {status !== "connected" && (
          <p className="mt-2.5 text-xs text-[#6E6973]">
            Speak in Arabic, English, or French, or select a prompt below.
          </p>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[#E5C9D0] bg-[#FAF1F3] px-3.5 py-2.5 text-xs text-[#733745]"
        >
          {errorMessage}
        </div>
      )}

      {/* Transcript / Quick Prompts */}
      <div className="flex flex-1 flex-col justify-between border-t border-[#EFEAE5] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#5E5A63]">
            {transcript.length > 0 ? "Conversation" : "Suggested Recruiter Questions"}
          </span>
          {transcript.length > 0 && (
            <button
              type="button"
              onClick={onClearTranscript}
              className="text-xs font-medium text-[#6E6973] transition-colors hover:text-[#1E1D20] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {transcript.length === 0 ? (
          <div className="mb-4 grid grid-cols-1 gap-2">
            {quickQuestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                dir="auto"
                onClick={() => onAskQuestion(prompt)}
                className="rounded-lg border border-[#EAE4DE] bg-[#FAF8F6] px-3.5 py-2 text-start text-xs font-medium text-[#343137] transition-colors duration-150 hover:border-[#D6C9CE] hover:bg-[#F5EFF2] cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-4 max-h-48 space-y-3 overflow-y-auto pr-1">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                  entry.role === "agent"
                    ? "bg-[#F6F1F3] text-[#1E1D20]"
                    : "bg-[#FAF8F6] text-[#454149]"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold text-[#6B4C5B]">
                  {entry.role === "agent" ? "Laila's Representative" : "You"}
                </p>
                <p dir="auto" className="whitespace-pre-wrap">
                  {entry.text}
                </p>
              </div>
            ))}
            {isTextThinking && (
              <div className="rounded-lg bg-[#F6F1F3] px-3.5 py-2.5 text-xs text-[#6E6973]">
                Reviewing CV details...
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Written Question Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="written-question" className="sr-only">
            Ask a question in writing
          </label>
          <input
            id="written-question"
            type="text"
            dir="auto"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder={inputPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-[#E2DCD5] bg-[#FAF8F6] px-3.5 py-2 text-xs text-[#1E1D20] placeholder-[#7B7680] transition-colors focus:border-[#6B4C5B] focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!questionInput.trim() || isTextThinking}
            aria-label="Send question"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAE3E6] text-[#4C3641] transition-colors duration-150 hover:bg-[#DFD2D7] disabled:opacity-45 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </section>
  );
}
