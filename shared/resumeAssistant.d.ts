export declare const ALLOWED_VOICES: Set<string>;
export declare const ALLOWED_LANGS: Set<string>;
export declare const LANGUAGE_LABELS: Record<string, string>;
export declare const LAILA_RESUME_SYSTEM_INSTRUCTION: string;

export declare function normalizeVoice(requested?: unknown): string;
export declare function normalizeLang(requested?: unknown): string;
export declare function buildGreetingPrompt(lang: string): string;

export declare function generateResumeAnswer(params: {
  apiKey: string;
  question: string;
  history?: Array<{ role?: string; text?: string }>;
  language?: string;
}): Promise<string>;

export declare function mintLiveVoiceToken(params: {
  apiKey: string;
  voice?: unknown;
  lang?: unknown;
}): Promise<{
  token: string;
  voice: string;
  lang: string;
  greetingPrompt: string;
}>;
