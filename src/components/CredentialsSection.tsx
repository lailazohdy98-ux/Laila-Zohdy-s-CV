import { CERTIFICATIONS, EDUCATION, RESUME_PROFILE } from "../data/resumeData";

export function CredentialsSection() {
  return (
    <section
      id="credentials"
      className="mx-auto max-w-[1200px] border-t border-[#E8E2DC] px-6 py-16 md:px-10 md:py-20"
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="text-xs font-medium text-[#6B4C5B]">Academic Background</p>
          <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-[#1E1D20]">
            Education
          </h2>
          <div className="mt-5 rounded-2xl border border-[#E6E0DA] bg-white p-6">
            <p className="tabular-nums text-xs font-medium text-[#6E6973]">
              {EDUCATION.date}
            </p>
            <h3 className="mt-1.5 text-base font-semibold text-[#1E1D20]">
              {EDUCATION.degree}
            </h3>
            <p className="mt-1 text-sm text-[#5E5A63]">{EDUCATION.institution}</p>
          </div>
        </div>

        <div className="lg:col-span-7">
          <p className="text-xs font-medium text-[#6B4C5B]">Continuous Learning</p>
          <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-[#1E1D20]">
            Certifications
          </h2>
          <div className="mt-5 divide-y divide-[#EAE4DE] rounded-2xl border border-[#E6E0DA] bg-white px-6">
            {CERTIFICATIONS.map((cert) => (
              <div
                key={cert}
                className="flex items-center justify-between py-3.5 text-sm font-medium text-[#2A282D]"
              >
                <span>{cert}</span>
                <span className="text-xs font-normal text-[#6E6973]">Verified</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact & Direct Links Footer */}
      <footer className="mt-20 flex flex-col items-start justify-between gap-6 border-t border-[#E8E2DC] pt-8 md:flex-row md:items-center">
        <div>
          <p className="font-display text-2xl font-semibold text-[#1E1D20]">
            {RESUME_PROFILE.name}
          </p>
          <p className="mt-1 text-xs text-[#5E5A63]">
            {RESUME_PROFILE.location} · {RESUME_PROFILE.authorization} ·{" "}
            {RESUME_PROFILE.languagesSummary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-[#4A464F]">
          <a
            href={`mailto:${RESUME_PROFILE.email}`}
            className="whitespace-nowrap transition-colors hover:text-[#6B4C5B] hover:underline underline-offset-4"
          >
            {RESUME_PROFILE.email}
          </a>
          <a
            href={RESUME_PROFILE.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap transition-colors hover:text-[#6B4C5B] hover:underline underline-offset-4"
          >
            LinkedIn
          </a>
          <a
            href={RESUME_PROFILE.portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap transition-colors hover:text-[#6B4C5B] hover:underline underline-offset-4"
          >
            Portfolio
          </a>
          <a
            href={RESUME_PROFILE.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap rounded-lg border border-[#DCD5CE] bg-white px-3.5 py-2 text-[#1E1D20] transition-colors hover:bg-[#F5F1ED]"
          >
            Download PDF CV
          </a>
        </div>
      </footer>
    </section>
  );
}
