export interface ReplyStyleTheme {
  id: string;
  name: string;
  persona: string;
  baseStyle: string;
  multipleStyles: string[];
  multipleProbability: number;
  builtin: boolean;
}

export interface EmotionTheme {
  id: string;
  name: string;
  defaultEmotion: string;
  updateIntervalMs: number;
  emotions: Record<string, { examples: string[] }>;
  builtin: boolean;
}

export interface ThemeCatalog {
  reply: ReplyStyleTheme[];
  emotion: EmotionTheme[];
}

export const EMPTY_THEME_CATALOG: ThemeCatalog = { reply: [], emotion: [] };

export function isBuiltinThemeId(id: string | undefined): boolean {
  return String(id ?? "").startsWith("builtin:");
}

export function createCustomThemeId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `custom:${random}`;
}
