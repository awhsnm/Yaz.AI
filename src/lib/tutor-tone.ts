/**
 * Tone contract for the AI tutor / Socratic coach.
 *
 * The tutor must open and respond with a direct analytical question — no
 * greetings, emojis, capability menus, praise, or filler phrasing.
 */

export interface TonePattern {
  id: string;
  label: string;
  pattern: RegExp;
}

/** Emoji / pictograph ranges (surrogate-pair safe, no `u` flag needed). */
const EMOJI_PATTERN =
  /[\u2190-\u21FF\u2300-\u23FF\u25A0-\u27BF\u2B00-\u2BFF\uFE0F\u200D]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/;

export const TONE_FORBIDDEN_PATTERNS: TonePattern[] = [
  {
    id: "greeting",
    label: "greetings / self-introduction",
    pattern:
      /\b(welcome|hello|hi there|hey|good (morning|afternoon|evening)|i'?m your|i am your|nice to meet you|let'?s get started)\b/i,
  },
  {
    id: "emoji",
    label: "emojis",
    pattern: EMOJI_PATTERN,
  },
  {
    id: "menu",
    label: "capability menus",
    pattern:
      /(you can ask me|here'?s what i can|i can help you with[:\s]|how would you like to (start|begin)|choose one of|feel free to ask)/i,
  },
  {
    id: "praise",
    label: "automatic praise / motivational filler",
    pattern:
      /\b(great (job|choice|question|that)|it'?s great that|well done|awesome|excellent (choice|question)|good luck|you'?ve got this|nice work|interesting topic|it'?s a (timely|fascinating|relevant) topic)\b/i,
  },
  {
    id: "filler",
    label: "filler / throat-clearing phrasing",
    pattern:
      /(before we (jump|dive|get) into|let'?s dive in|first of all,|to begin with,|as an ai|i'?m here to help|happy to help)/i,
  },
];

/** Returns the ids of every tone rule the text violates. */
export function findToneViolations(text: string): string[] {
  return TONE_FORBIDDEN_PATTERNS.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id);
}

export function violatesTone(text: string): boolean {
  return findToneViolations(text).length > 0;
}

/**
 * The tutor's opening message: a single direct question about the student's
 * claim, with no greeting, preamble, or menu.
 */
export function buildOpeningQuestion(topic: string, _subject?: string): string {
  const cleaned = topic
    .trim()
    .replace(/^(why|how|what|should|is|are|do|does)\s+/i, "")
    .replace(/[.?!]+$/, "");
  return `What specific claim will your essay make about ${cleaned || "this topic"}?`;
}

/** Maximum words allowed in a coach question. */
export const MAX_QUESTION_WORDS = 25;

/**
 * Enforce the "single concise question" contract on any coach/tutor output.
 * Returns the trimmed single question, or null when nothing usable remains.
 */
export function enforceSingleQuestion(raw: string): string | null {
  if (!raw) return null;
  // Strip markdown decoration, list markers and line breaks.
  let text = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`>#]/g, "")
    .replace(/^\s*[-•\d.]+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  // Keep only the first question sentence.
  const firstMark = text.indexOf("?");
  if (firstMark === -1) return null;
  text = text.slice(0, firstMark + 1);

  // Drop any leading statements before the question itself.
  const parts = text.split(/(?<=[.!])\s+/);
  text = parts[parts.length - 1].trim();
  text = text.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  if (!text.endsWith("?")) return null;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_QUESTION_WORDS) return null;
  return text;
}
