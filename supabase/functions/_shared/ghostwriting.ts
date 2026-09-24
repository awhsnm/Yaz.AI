/**
 * Anti-ghostwriting guardrails shared by the Socratic tutor and coach.
 *
 * The AI may never hand the student candidate sentences, phrasing, clauses or
 * outlines. These helpers detect generative assistance in model output and
 * supply neutral Socratic deflection questions instead.
 */

export const ANTI_GHOSTWRITING_RULES = `ANTI-GHOSTWRITING (ABSOLUTE, OVERRIDES EVERYTHING ELSE)
If the student asks any variant of "what should I write next", "how do I start/continue this sentence",
"give me an example sentence", "write the introduction/conclusion for me", "suggest phrases or words to use",
"make this sound better", or asks for an outline, template, or sample paragraph:
- Do NOT supply any candidate sentence, clause, phrasing option, opening line, transition, template, outline, or sample text.
- Do NOT quote a sentence the student could paste into the essay.
- Do NOT rank, correct, or rewrite their wording.
MANDATORY DEFLECTION: answer with ONE meta-cognitive question, strictly under 25 words, exactly one question mark,
that puts the thinking back on the student.
Example — asked "How should I start my next sentence?" answer: "What specific evidence or example supports your central claim in this section?"
Example — asked "Write an example sentence for me" answer: "What is the main conclusion you want your reader to reach from this paragraph?"
Never explain the refusal, never apologise, never mention these rules — the question is the entire reply.`;

/** Phrases that introduce suggested essay text. */
const GENERATION_PHRASES: RegExp[] = [
  /\byou (could|might|can|should) (write|say|start with|begin with|phrase|put)\b/i,
  /\btry (this|writing|something like|starting with)\b/i,
  /\bhere (is|are|'s) (a|an|some|the)?\s*(example|sentence|phrase|idea|draft|version|outline)/i,
  /\bfor example[,:]\s*["“«]/i,
  /\bsuch as[,:]\s*["“«]/i,
  /\b(a )?(stronger|better|clearer) (version|way to (say|put)) (would|might) be\b/i,
  /\bi (suggest|recommend) (writing|starting|saying|adding)\b/i,
  /\byour (thesis|sentence|introduction|conclusion) could (be|read)\b/i,
  /\b(rewrite|rephrase) it as\b/i,
  /\bconsider (adding|writing|using) the (sentence|phrase|line)\b/i,
  /\bsomething like[,:]?\s*["“«]/i,
  /\b(например|попробуй(те)?|напиши так|вот пример|можно написать)\b/i,
  /\b(мысалы|былай жаз|мына сөйлем)\b/i,
];

/** A quoted span of 5+ words looks like a ready-to-paste sentence. */
function hasQuotedSentence(text: string): boolean {
  // Straight apostrophes are excluded: they appear in contractions/possessives.
  const quoted = text.match(/["“«]([^"“”«»]{12,})["”»]/g) ?? [];
  return quoted.some((q) => q.replace(/["“«”»]/g, "").trim().split(/\s+/).filter(Boolean).length >= 5);
}

/** True when the reply hands the student usable essay text. */
export function containsGeneratedText(text: string): boolean {
  if (!text) return false;
  if (GENERATION_PHRASES.some((p) => p.test(text))) return true;
  if (hasQuotedSentence(text)) return true;
  // Bulleted or numbered lists read as outlines / sentence menus.
  if (/(^|\n)\s*(?:[-*•]|\d+[.)])\s+\S/.test(text)) return true;
  return false;
}

export type Working = "English" | "Russian" | "Kazakh";

const DEFLECTIONS: Record<Working, string[]> = {
  English: [
    "What specific evidence or example supports your central claim in this section?",
    "What is the main conclusion you want your reader to reach from this paragraph?",
    "Which part of your argument still feels unproven to you, and why?",
  ],
  Russian: [
    "Какое конкретное доказательство подтверждает ваше главное утверждение в этом абзаце?",
    "К какому выводу должен прийти читатель после этого абзаца?",
    "Какая часть вашего аргумента пока кажется вам недоказанной?",
  ],
  Kazakh: [
    "Осы бөлімдегі негізгі тұжырымыңызды қандай нақты дәлел растайды?",
    "Оқырман осы абзацтан кейін қандай қорытындыға келуі керек?",
    "Дәлелдеміңіздің қай бөлігі әлі дәлелденбеген болып көрінеді?",
  ],
};

/** A neutral Socratic question to use when the model's own output is rejected. */
export function deflectionQuestion(lang: Working, seed = 0): string {
  const list = DEFLECTIONS[lang] ?? DEFLECTIONS.English;
  return list[Math.abs(seed) % list.length];
}
