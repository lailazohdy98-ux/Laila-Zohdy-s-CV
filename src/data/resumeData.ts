export type VoiceLanguage = "en" | "fr" | "ar";

export interface ExperienceRole {
  id: string;
  company: string;
  title: string;
  period: string;
  locationContext: string;
  category: "leadership" | "analysis";
  highlights: string[];
  voicePrompt: string;
}

export interface CapabilityGroup {
  id: string;
  title: string;
  surfaceTint: string;
  items: string[];
}

export interface ImpactMetric {
  value: string;
  label: string;
  detail: string;
}

export const RESUME_PROFILE = {
  name: "Laila Zohdy",
  role: "Communications & Marketing Project Manager",
  location: "Paris, France",
  authorization: "Authorised to work in France",
  email: "laila.zohdy98@gmail.com",
  linkedinUrl: "https://www.linkedin.com/in/laila-molzino-608446174/",
  portfolioUrl: "https://portfoliolailamolz.netlify.app/",
  pdfUrl: "/assets/aistudio/__Laila_Zohdy__CV_EN_2d0c8541.pdf",
  summary:
    "Communications & Marketing professional with 5+ years of experience across international environments. I build and run communications functions end-to-end: strategy, content, PR, social, SEO, and paid campaigns, leveraging modern AI and analytics workflows to turn data into executive decisions.",
  languagesSummary: "Bilingual English & Arabic · French B2",
};

export const IMPACT_METRICS: ImpactMetric[] = [
  {
    value: "5+ Years",
    label: "International Experience",
    detail: "Across Paris, Prague & UK/CZ markets",
  },
  {
    value: "400%+",
    label: "Audience Growth",
    detail: "Delivered via integrated brand campaigns",
  },
  {
    value: "280+",
    label: "Launch Applications",
    detail: "Generated from a single go-to-market launch",
  },
  {
    value: "#1",
    label: "Branded Search Ranking",
    detail: "Achieved within 2 months of rollout",
  },
];

export const EXPERIENCE_ROLES: ExperienceRole[] = [
  {
    id: "tzkrti",
    company: "Tzkrti.com",
    title: "Communications & Marketing Project Manager",
    period: "Aug 2025 – Present",
    locationContext: "Event-tech startup · Remote from Paris · Solo marketing function",
    category: "leadership",
    highlights: [
      "Work directly with the CEO to manage and deliver integrated communications and marketing projects across strategy, content, PR, and paid campaigns.",
      "Manage timelines, budgets, and briefs across multiple workstreams, ensuring deliverables remain on track, on brand, and aligned with company priorities.",
      "Lead day-to-day coordination with an in-house designer, a marketing consultant, and an external SEO agency as primary point of contact and quality reviewer.",
      "Prepare monthly performance reports consolidating analytics data into clear executive summaries with recommended actions.",
      "Draft and review external communications including press materials, newsletters, and promotional copy prior to distribution.",
      "Manage shared drives, content calendars, and document templates, and coordinate influencer, media, and partnership outreach.",
    ],
    voicePrompt:
      "Tell me about Laila's current role running the solo marketing function at Tzkrti.com.",
  },
  {
    id: "ledvance",
    company: "Ledvance",
    title: "Global Communications Manager",
    period: "Jun 2024 – Jul 2025",
    locationContext: "Global lighting tech (ex-Osram) · Prague · Multi-market B2B & B2C",
    category: "leadership",
    highlights: [
      "Supported the Head of Brand and Communications in managing global communications projects across LinkedIn, Instagram, Facebook, and YouTube aligned with product launches and international go-to-market priorities.",
      "Served as primary point of contact for creative and PR agencies: briefed campaigns, reviewed deliverables, maintained brand consistency, and coordinated approval workflows.",
      "Coordinated sustainability communications projects, managing information flow between the sustainability team and the global brand function.",
      "Tracked and reported social KPIs weekly using Emplifi, LinkedIn Analytics, and Meta Business Manager, translating data into optimisation decisions for senior stakeholders.",
      "Managed the corporate press inbox, handled media relations, and produced internal newsletters via Klaviyo distributed to all global employees.",
    ],
    voicePrompt:
      "How did Laila coordinate global agencies, sustainability teams, and KPIs at Ledvance?",
  },
  {
    id: "accenture-senior",
    company: "Accenture",
    title: "Senior Media Analyst",
    period: "May 2023 – May 2024",
    locationContext: "Global professional services · Prague · Promoted from Media Analyst",
    category: "analysis",
    highlights: [
      "Delivered 4 daily executive-level media monitoring reports and 2 biweekly digests to Senior Managers, Managing Directors, and the CEO under strict deadlines.",
      "Led competitor and industry analysis to inform strategic communications decisions, managing real-time crisis monitoring, escalation, and briefing.",
      "Built Boolean search queries and monitoring dashboards to improve tracking accuracy and reporting efficiency.",
      "Mentored 3 to 5 junior analysts and contributed to internal press release drafting and communications planning.",
    ],
    voicePrompt:
      "What did Laila's executive reporting and crisis monitoring work at Accenture involve?",
  },
  {
    id: "accenture-analyst",
    company: "Accenture",
    title: "Media Analyst",
    period: "Mar 2021 – May 2023",
    locationContext: "Global professional services · Prague · Promoted within 2 years",
    category: "analysis",
    highlights: [
      "Monitored multi-channel media coverage across online, print, broadcast, and social platforms.",
      "Produced daily and weekly reports for international communications stakeholders and supported real-time crisis monitoring and escalation.",
    ],
    voicePrompt:
      "How did Laila earn her promotion from Media Analyst to Senior Media Analyst at Accenture?",
  },
  {
    id: "rfe-rl",
    company: "Radio Free Europe / Radio Liberty",
    title: "Copywriter & Editor Intern",
    period: "Nov 2019 – Feb 2020",
    locationContext: "Prague · International newsroom",
    category: "analysis",
    highlights: [
      "Translated and adapted breaking news from Arabic to English for digital publication under strict editorial deadlines.",
    ],
    voicePrompt:
      "Tell me about Laila's bilingual editorial experience at Radio Free Europe.",
  },
];

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: "comms",
    title: "Communications & Content",
    surfaceTint: "bg-[#F6F0F2]",
    items: [
      "PR & Media Relations",
      "Copywriting & Editorial Review",
      "Press Materials & Releases",
      "Internal Communications",
      "Brand Consistency",
      "Integrated Campaign Management",
      "SEO Strategy",
      "Email Marketing",
    ],
  },
  {
    id: "operations",
    title: "Project & Stakeholder Operations",
    surfaceTint: "bg-[#EFF4F1]",
    items: [
      "Executive Briefing & Reporting",
      "Agency & Consultant Coordination",
      "Calendar & Schedule Management",
      "Budget Tracking & Workstreams",
      "Deck Development & Formatting",
      "Google Workspace",
      "Monday.com & Asana",
    ],
  },
  {
    id: "analytics",
    title: "Analytics & Reporting Stack",
    surfaceTint: "bg-[#F1F2F7]",
    items: [
      "Emplifi & Meltwater",
      "Factiva & Power BI",
      "Google Analytics",
      "Meta Ads Manager",
      "LinkedIn Analytics",
      "Klaviyo & Brevo",
    ],
  },
  {
    id: "ai-design-lang",
    title: "Design, AI Workflows & Languages",
    surfaceTint: "bg-[#F7F3EE]",
    items: [
      "Claude & ChatGPT (daily research, drafting & workflow acceleration)",
      "Canva & Google Slides (brand-aligned decks & visual layout)",
      "English (Bilingual)",
      "Arabic (Bilingual)",
      "French (B2 Intermediate)",
    ],
  },
];

export const EDUCATION = {
  institution: "Teesside University (UK/CZ)",
  degree: "BA Creative Media Production (Journalism Major)",
  date: "June 2020",
};

export const CERTIFICATIONS = [
  "Google Project Management",
  "Google Analytics",
  "HubSpot SEO",
  "Meltwater Reporting & Dashboards",
  "Intro to Generative AI (Accenture)",
];

export const QUICK_RECRUITER_QUESTIONS_BY_LANG: Record<VoiceLanguage, string[]> = {
  en: [
    "Walk me through her 400%+ audience growth and launch results.",
    "How does she run a solo marketing function at Tzkrti.com?",
    "Is she based in Paris and authorised to work in France?",
  ],
  fr: [
    "Parlez-moi de sa croissance d'audience de plus de 400%.",
    "Comment gère-t-elle seule le marketing chez Tzkrti.com ?",
    "Est-elle basée à Paris et autorisée à travailler en France ?",
  ],
  ar: [
    "حدثيني عن تحقيقها نمواً في الجمهور بنسبة تفوق 400%.",
    "كيف تدير وظيفة التسويق بمفردها في شركة Tzkrti.com؟",
    "هل تقيم في باريس ولديها تصريح عمل في فرنسا؟",
  ],
};
