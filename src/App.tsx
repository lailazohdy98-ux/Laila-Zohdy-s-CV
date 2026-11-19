import { ArrowUpRight, FileText, Mic } from "lucide-react";
import { CapabilitiesSection } from "./components/CapabilitiesSection";
import { CredentialsSection } from "./components/CredentialsSection";
import { ExperienceSection } from "./components/ExperienceSection";
import { Header } from "./components/Header";
import { VoiceStudio } from "./components/VoiceStudio";
import { IMPACT_METRICS, RESUME_PROFILE } from "./data/resumeData";
import { useVoiceAgent } from "./hooks/useVoiceAgent";

export default function App() {
  const {
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
  } = useVoiceAgent();

  const scrollToStudio = () => {
    const el = document.getElementById("voice-studio");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleHeaderAction = () => {
    scrollToStudio();
    if (status === "idle" || status === "error") {
      startSession();
    }
  };

  const handleAskAboutRole = (prompt: string) => {
    scrollToStudio();
    askQuestion(prompt);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F6] text-[#1E1D20]">
      <Header
        isConnected={status === "connected"}
        onPrimaryAction={handleHeaderAction}
      />

      <main>
        {/* Hero Split Section */}
        <section
          id="overview"
          className="mx-auto max-w-[1200px] px-6 pt-12 pb-14 md:px-10 md:pt-16 md:pb-20"
        >
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Editorial Bio Column */}
            <div className="flex flex-col justify-between lg:col-span-6">
              <div>
                <p className="text-xs font-medium text-[#6E6973]">
                  {RESUME_PROFILE.location}
                  <span aria-hidden="true" className="mx-2">
                    ·
                  </span>
                  {RESUME_PROFILE.authorization}
                  <span aria-hidden="true" className="mx-2">
                    ·
                  </span>
                  {RESUME_PROFILE.languagesSummary}
                </p>

                <h1
                  style={{ textWrap: "balance" }}
                  className="mt-5 font-display text-[clamp(2.35rem,4.2vw,3.65rem)] font-semibold leading-[1.08] tracking-tight text-[#1E1D20]"
                >
                  Communications &amp; Marketing Project Manager.
                </h1>

                <p className="mt-6 max-w-xl text-[15px] leading-[1.7] text-[#454149] md:text-base">
                  {RESUME_PROFILE.summary}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      status === "connected" ? stopSession() : startSession()
                    }
                    disabled={status === "connecting"}
                    className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#6B4C5B] px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#573C49] disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4C5B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F6]"
                  >
                    <Mic className="h-4 w-4" />
                    {status === "connected"
                      ? "End Voice Interview"
                      : status === "connecting"
                        ? "Connecting Voice..."
                        : "Start Voice Interview"}
                  </button>

                  <a
                    href={RESUME_PROFILE.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-[#DCD5CE] bg-white px-4 py-3 text-sm font-medium text-[#1E1D20] transition-colors duration-150 hover:bg-[#F5F1ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4C5B]"
                  >
                    <FileText className="h-4 w-4 text-[#6B4C5B]" />
                    Resume PDF
                  </a>
                </div>
              </div>

              {/* Direct Recruiter Links */}
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#E8E2DC] pt-5 text-xs font-medium text-[#5E5A63]">
                <a
                  href={`mailto:${RESUME_PROFILE.email}`}
                  className="inline-flex items-center gap-1 transition-colors hover:text-[#1E1D20]"
                >
                  {RESUME_PROFILE.email}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                <a
                  href={RESUME_PROFILE.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-[#1E1D20]"
                >
                  LinkedIn
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                <a
                  href={RESUME_PROFILE.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-[#1E1D20]"
                >
                  Portfolio
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Right Interactive Voice Agent Studio */}
            <div className="lg:col-span-6">
              <VoiceStudio
                status={status}
                voiceName={voiceName}
                language={language}
                isMuted={isMuted}
                agentSpeaking={agentSpeaking}
                userLevel={userLevel}
                agentLevel={agentLevel}
                transcript={transcript}
                errorMessage={errorMessage}
                isTextThinking={isTextThinking}
                onStart={() => startSession()}
                onStop={stopSession}
                onToggleMute={toggleMute}
                onChangeVoice={changeVoice}
                onChangeLanguage={changeLanguage}
                onAskQuestion={askQuestion}
                onClearTranscript={clearTranscript}
              />
            </div>
          </div>

          {/* Full-width 4-Column Proof Strip */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {IMPACT_METRICS.map((metric, idx) => {
              const tints = [
                "bg-[#F6F0F2]",
                "bg-[#EFF4F1]",
                "bg-[#F1F2F7]",
                "bg-[#F7F3EE]",
              ];
              return (
                <div
                  key={metric.label}
                  className={`rounded-xl border border-[#E6E0DA] px-5 py-5 ${tints[idx % tints.length]}`}
                >
                  <p className="tabular-nums font-display text-3xl font-semibold tracking-tight text-[#1E1D20]">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#6B4C5B]">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-xs text-[#5E5A63]">{metric.detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        <ExperienceSection onAskAboutRole={handleAskAboutRole} />
        <CapabilitiesSection />
        <CredentialsSection />
      </main>
    </div>
  );
}
