import { CAPABILITY_GROUPS } from "../data/resumeData";

export function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      className="mx-auto max-w-[1200px] border-t border-[#E8E2DC] px-6 py-16 md:px-10 md:py-20"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-medium text-[#6B4C5B]">Skills & Stack</p>
        <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-[#1E1D20] md:text-4xl">
          Capabilities &amp; Tools
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#5E5A63]">
          End-to-end execution combining editorial craft, multi-agency project
          coordination, analytics reporting, and daily AI-accelerated workflows.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
        {CAPABILITY_GROUPS.map((group) => (
          <div
            key={group.id}
            className={`rounded-2xl border border-[#E6E0DA] p-6 md:p-7 ${group.surfaceTint}`}
          >
            <h3 className="font-display text-2xl font-semibold text-[#1E1D20]">
              {group.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#38353B]">
              {group.items.join(" · ")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
