/**
 * Shared pre-evaluation filter used by every essay feedback / evaluation
 * function. Stops the model from inventing praise for gibberish, chat
 * messages, placeholder notes or off-topic filler.
 */

export const DEFAULT_REJECTION =
  "The submitted draft does not appear to be an argumentative or analytical essay. It consists of informal notes, placeholder commentary, or unrelated text. Please draft an essay that directly addresses the prompt to receive a diagnostic evaluation.";

export const VALIDITY_RULES = `PRE-EVALUATION FILTER (run this first, zero tolerance)
Before producing any rubric feedback, decide whether the submission is a genuine attempt at an essay.
Mark it INVALID when the text is any of:
- gibberish, keyboard mash, or pasted nonsense;
- casual conversation or meta-commentary (e.g. "Привет, как дела?", "just testing the system", placeholder notes);
- completely off-topic, or makes no coherent claim at all;
- filler repetition written only to pass a word counter.
If INVALID, return ONLY this JSON and nothing else:
{"is_valid_essay": false, "status": "unusable_submission", "message": "<the rejection message>"}
The rejection message must be this text, translated into the student's writing language if it is not English:
"${DEFAULT_REJECTION}"
Never praise the student, never invent a connection to the prompt, never soften the rejection.
If the submission IS a genuine essay attempt, include "is_valid_essay": true in your JSON and continue with the normal output shape.

ANTI-SYCOPHANCY AND EVIDENCE RULES (valid essays)
- Never praise mechanical artifacts such as submitting on time, testing the interface, typing paragraphs, or writing enough words.
- Every positive statement must cite a specific argument, thesis formulation or substantiated claim actually present in the text.
- If no such claims exist, say exactly: "No clear argumentative claims were identified in this draft." (translated into the student's language when the essay is not in English).

LANGUAGE
- Write all feedback in the same primary language the student wrote the essay in (English, Russian or Kazakh), unless the assignment fixes a different course language.`;

/** Returns the rejection payload when the model flagged the draft as unusable. */
export function rejection(parsed: Record<string, unknown> | null | undefined) {
  if (!parsed || parsed.is_valid_essay !== false) return null;
  const msg = typeof parsed.message === "string" && parsed.message.trim().length > 20
    ? parsed.message.trim().slice(0, 600)
    : DEFAULT_REJECTION;
  return { is_valid_essay: false, status: "unusable_submission", message: msg };
}
