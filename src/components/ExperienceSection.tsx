import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { EXPERIENCE_ROLES, ExperienceRole } from "../data/resumeData";

interface ExperienceSectionProps {
  onAskAboutRole: (prompt: string) => void;
}

export function ExperienceSection({ onAskAboutRole }: ExperienceSectionProps) {
  const [filter, setFilter] = useState<"all" | "leadership" | "analysis">("all");

  const filteredRoles = EXPERIENCE_ROLES.filter((role) =>
    filter === "all" ? true : role.category === filter
  );

  return (
    <section
      id="experience"
      className="mx-auto max-w-[1200px] border-t border-[#E8E2DC] px-6 py-16 md:px-10 md:py-20"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium text-[#6B4C5B]">Career History</p>
          <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-[#1E1D20] md:text-4xl">
            Professional Experience
          </h2>
        </div>

        <div
          role="group"
          aria-label="Filter roles by focus"
          className="flex items-center gap-1 self-start rounded-lg bg-[#EFEAE5] p-1 md:self-auto"
        >
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer ${
              filter === "all"
                ? "bg-white text-[#1E1D20] shadow-xs"
                : "text-[#5E5A63] hover:text-[#1E1D20]"
            }`}
          >
            All Roles
          </button>
          <button
            type="button"
            onClick={() => setFilter("leadership")}
            className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer ${
              filter === "leadership"
                ? "bg-white text-[#1E1D20] shadow-xs"
                : "text-[#5E5A63] hover:text-[#1E1D20]"
            }`}
          >
            Communications & Strategy
          </button>
          <button
            type="button"
            onClick={() => setFilter("analysis")}
            className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer ${
              filter === "analysis"
                ? "bg-white text-[#1E1D20] shadow-xs"
                : "text-[#5E5A63] hover:text-[#1E1D20]"
            }`}
          >
            Media Analysis & Editorial
          </button>
        </div>
      </div>

      <div className="mt-10 divide-y divide-[#E8E2DC]">
        {filteredRoles.map((role: ExperienceRole) => (
          <article
            key={role.id}
            className="grid grid-cols-1 gap-6 py-8 first:pt-2 last:pb-0 lg:grid-cols-12 lg:gap-10"
          >
            <div className="lg:col-span-4">
              <p className="tabular-nums text-xs font-medium text-[#6E6973]">
                {role.period}
              </p>
              <h3 className="mt-1.5 text-lg font-semibold text-[#1E1D20]">
                {role.title}
              </h3>
              <p className="mt-0.5 text-sm font-medium text-[#6B4C5B]">
                {role.company}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#5E5A63]">
                {role.locationContext}
              </p>

              <button
                type="button"
                onClick={() => onAskAboutRole(role.voicePrompt)}
                className="mt-4 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#E2DCD5] bg-white px-3 py-1.5 text-xs font-medium text-[#46424A] transition-colors duration-150 hover:border-[#CBBBC2] hover:bg-[#F7F2F4] cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5 text-[#6B4C5B]" />
                Ask assistant about this role
              </button>
            </div>

            <div className="lg:col-span-8">
              <ul className="space-y-2.5 text-sm leading-relaxed text-[#38353B]">
                {role.highlights.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C7B3BC]"
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
