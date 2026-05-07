/**
 * Lightweight session memory: extract style/tone adjectives from user messages
 * so subsequent turns can stay coherent. Pure keyword detection — cheap,
 * never wrong in a damaging way (worst case: a preference doesn't get tracked).
 *
 * Not an LLM call. Runs synchronously every time the user sends a message and
 * accumulates into the store's `vibePreferences` slice.
 */

const VOCAB: Record<string, string[]> = {
  // tone
  warm: ["warm", "cozy", "friendly", "inviting", "earthy"],
  cool: ["cool", "calm", "icy", "blue", "cold"],
  bold: ["bold", "punchy", "vibrant", "loud", "energetic", "striking"],
  subtle: ["subtle", "muted", "soft", "understated", "quiet", "minimal", "minimalist"],
  playful: ["playful", "fun", "whimsical", "quirky", "cute"],
  professional: ["professional", "corporate", "serious", "polished"],
  modern: ["modern", "sleek", "contemporary", "current"],
  vintage: ["vintage", "retro", "nostalgic", "old-school"],
  // mode
  dark: ["dark", "night", "midnight", "black"],
  light: ["light", "bright", "white", "airy"],
  // density
  compact: ["compact", "dense", "tight", "condensed"],
  spacious: ["spacious", "roomy", "breathable", "open", "airy"],
  // visual references
  linear: ["linear-style", "like linear", "linear feel"],
  notion: ["like notion", "notion feel", "notion-style"],
  apple: ["apple-style", "like apple", "ios feel"],
  stripe: ["stripe-style", "like stripe"],
};

export type VibeTag = keyof typeof VOCAB;

/**
 * Extract zero or more vibe tags from a user message. Returns an empty array
 * when nothing matches — most utility messages ("add a chart") produce nothing.
 */
export function extractVibeTags(message: string): VibeTag[] {
  if (!message) return [];
  const lower = message.toLowerCase();
  const tags = new Set<VibeTag>();
  for (const [tag, patterns] of Object.entries(VOCAB)) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        tags.add(tag as VibeTag);
        break;
      }
    }
  }
  return [...tags];
}

export interface VibePreferences {
  /** Tag → number of times the tag has appeared in user messages this session. */
  tags: Record<string, number>;
  /** Last user message that contributed at least one tag (verbatim). Bounded length. */
  lastTonalRequest: string | null;
}

export const EMPTY_VIBE_PREFERENCES: VibePreferences = {
  tags: {},
  lastTonalRequest: null,
};

const MAX_LAST_REQUEST_LEN = 200;

export function mergeVibe(prev: VibePreferences, message: string): VibePreferences {
  const tags = extractVibeTags(message);
  if (tags.length === 0) return prev;
  const next: Record<string, number> = { ...prev.tags };
  for (const t of tags) next[t] = (next[t] ?? 0) + 1;
  const trimmed =
    message.length > MAX_LAST_REQUEST_LEN
      ? message.slice(0, MAX_LAST_REQUEST_LEN) + "…"
      : message;
  return { tags: next, lastTonalRequest: trimmed };
}

/**
 * Render the preferences as a one-paragraph hint for the system prompt.
 * Returns empty string when nothing's been tracked.
 */
export function renderVibePreferences(prefs: VibePreferences): string {
  const entries = Object.entries(prefs.tags);
  if (entries.length === 0) return "";
  // Sort by frequency desc, take top 6.
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 6).map(([tag]) => tag);
  const parts: string[] = [`The user has gestured toward: **${top.join(", ")}**.`];
  if (prefs.lastTonalRequest) {
    parts.push(`Most recent tonal request: "${prefs.lastTonalRequest}".`);
  }
  parts.push(
    "Carry these forward — when the user makes a new request that doesn't override these signals, keep them coherent (same color temperature, density, vibe).",
  );
  return parts.join(" ");
}
