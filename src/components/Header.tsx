interface HeaderProps {
  isConnected: boolean;
  onPrimaryAction: () => void;
}

export function Header({ isConnected, onPrimaryAction }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E2DC] bg-[#FAF8F6]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4 md:px-10">
        <a
          href="#overview"
          className="font-display text-2xl font-semibold tracking-tight text-[#1E1D20] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4C5B] rounded"
        >
          Laila Zohdy
        </a>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5E5A63]"
        >
          <a
            href="#overview"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#1E1D20] hover:underline underline-offset-4 decoration-[#C8B4BC]"
          >
            Overview
          </a>
          <a
            href="#experience"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#1E1D20] hover:underline underline-offset-4 decoration-[#C8B4BC]"
          >
            Experience
          </a>
          <a
            href="#capabilities"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#1E1D20] hover:underline underline-offset-4 decoration-[#C8B4BC]"
          >
            Capabilities
          </a>
          <a
            href="#credentials"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#1E1D20] hover:underline underline-offset-4 decoration-[#C8B4BC]"
          >
            Credentials
          </a>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="whitespace-nowrap shrink-0 rounded-lg bg-[#6B4C5B] px-4 py-2 text-xs font-semibold tracking-wide text-white transition-colors duration-150 hover:bg-[#573C49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4C5B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F6] cursor-pointer"
          >
            {isConnected ? "Voice Session Active" : "Voice Interview"}
          </button>
        </div>
      </div>
    </header>
  );
}
