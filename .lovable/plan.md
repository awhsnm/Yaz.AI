# Dynamic Proactive Socratic AI Coach — Implementation Plan

No code, schema, or UI changes have been made. This is a plan only.

## 1. What already exists

- **Writing workspace** (`src/pages/StudentWorkspace.tsx`): essay text state, 5s auto-save to `essays.content`, 3s snapshot logging to `writing_events` (with paste detection), 45-min timer, submit/lock flow, three modes (classroom / solo / brainstorm).
- **Reactive AI tutor** (`src/components/AITutorSidebar.tsx` + `supabase/functions/ai-tutor`): streaming Socratic chat, but **student-initiated only**. It already carries a no-ghostwriting rule and receives the current draft as context.
- **Other AI functions**: `essay-feedback` (whole-essay JSON review), `generate-topics`, `detect-ai`, `extract-image-text`.
- **Database**: `profiles`, `essays`, `messages`, `annotations`, `evaluations`, `classrooms`, `user_roles`, `writing_events`, `bug_reports`, plus `has_role()` / `teacher_owns_essay_classroom()` helpers.
- **Teacher side**: `TeacherDashboard`, `TeacherReview` (annotations, grading), `WritingPlayback`.

So: draft capture, snapshots, AI gateway plumbing, and Socratic tone all exist. What does **not** exist is anything *proactive*, any issue-detection pass, any intervention budget, or any research log.

## 2. What must be added

1. **Trigger engine (client)** — watches the draft and decides *when* an analysis is allowed: ≥100 words, or an explicit save / paragraph completion (blank-line boundary). Debounced; never fires on every keystroke.
2. **Analysis Edge Function `socratic-coach`** — receives topic, subject, full draft, paragraph map, list of already-detected issue categories and already-questioned paragraph indices. Returns strict JSON: `{ intervene: boolean, issue_category, paragraph_index, question }`.
3. **Intervention budget guard** — server-side and client-side: max 1 question per paragraph, max 5 per essay.
4. **Coach prompt card (UI)** — a non-blocking card in the tutor sidebar (and a subtle inline marker on the paragraph) showing only the question plus **Answer / Not now / Skip**. "Answer" opens a reflection box that feeds back into the tutor thread.
5. **Research interaction log** — every shown/suppressed intervention recorded with before/after draft versions.
6. **Output sanitiser** — server-side guard that rejects any model output which is not a single question.

## 3. Files / components changed or created

| File | Change |
|---|---|
| `supabase/functions/socratic-coach/index.ts` | **new** — analysis + guardrails + logging |
| `supabase/config.toml` | **new entry** for the function |
| `src/hooks/useSocraticCoach.ts` | **new** — trigger detection, budget, invocation, log writes |
| `src/components/SocraticPrompt.tsx` | **new** — question card with Answer / Not now / Skip |
| `src/pages/StudentWorkspace.tsx` | wire the hook; pass paragraph boundaries; pass "Answer" text into the tutor sidebar |
| `src/components/AITutorSidebar.tsx` | render the coach card above the composer; accept a seeded reflection message |
| `src/i18n/locales/{en,ru,kk}.ts` | strings for the card controls and states |
| `src/pages/TeacherReview.tsx` | *(optional, later)* read-only panel showing which coach questions the student received and how they responded |

## 4. Database changes

**New table `coach_interventions`** (the research log):

| Field | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `essay_id` | uuid fk → essays | |
| `participant_id` | uuid | student id; anonymised hash exposed for export |
| `created_at` | timestamptz | timestamp |
| `text_stage` | text | `early` / `developing` / `revising` / `final` (derived from word count + submit state) |
| `word_count` | int | at trigger time |
| `trigger_event` | text | `word_threshold` \| `paragraph_saved` \| `manual_save` |
| `issue_category` | text | one of the nine categories, or `none` |
| `paragraph_index` | int | which paragraph the question targets |
| `question_shown` | text | nullable when suppressed |
| `suppressed_reason` | text | `uncertain` \| `budget_essay` \| `budget_paragraph` \| null |
| `user_action` | text | `answered` \| `not_now` \| `skipped` \| `ignored` |
| `reflection_response` | text | nullable |
| `draft_before` | text | snapshot at intervention |
| `draft_after` | text | snapshot written when the student next saves after acting |
| `model` | text | model id used |

**New column on `essays`**: `coach_questions_used` (int, default 0) — cheap server-side budget counter.

RLS: student can insert/select/update **their own** rows; teacher can select rows for essays in a classroom they own (`teacher_owns_essay_classroom`); `service_role` full. Explicit `GRANT`s in the same migration.

## 5. The exact system prompt

```text
You are a Socratic writing coach observing a student's developing argumentative essay.
You never teach by telling. You teach only by asking.

YOUR TASK
Read the student's draft. Decide whether there is ONE meaningful reasoning issue
worth raising right now. If there is, output ONE short Socratic question that helps
the student notice it themselves.

ISSUE CATEGORIES (choose at most one)
1. unclear_or_broad_thesis
2. thesis_claim_evidence_conclusion_inconsistency
3. unsupported_claim
4. evidence_without_link
5. hidden_assumption
6. missing_or_weak_counterargument
7. overgeneralisation
8. conclusion_mismatch
9. surface_only_revision

PRIORITY ORDER
Global coherence and thesis-claim-evidence consistency come first.
Raise local or language-level concerns only when no global issue exists.

POSITION CHANGE
A change in the student's position is NOT an error. If the position has shifted,
ask a question that helps the student judge whether their view has developed,
been qualified, or become inconsistent. Never ask them to return to their
original thesis. Never state that the student is wrong.

UNCERTAINTY
If you are not confident a meaningful issue exists, do not interrupt.
Return intervene = false. Silence is a valid and preferred answer.

ABSOLUTE PROHIBITIONS
Do not write or suggest essay text, paragraphs, thesis statements, topic sentences,
evidence, examples, citations, sources, outlines, summaries, or rewrites.
Do not praise, grade, score, label, analyse aloud, or explain your reasoning.
Do not give the answer inside the question.
Do not ask more than one question.

QUESTION FORM
One sentence. Under 25 words. Ends with a question mark.
Open-ended (starts with What / How / Why / Which / In what way / Where).
Grounded in the student's actual wording — you may quote at most 6 of their words.

OUTPUT FORMAT
Return ONLY this JSON object and nothing else:
{"intervene": true|false, "issue_category": "<category or none>",
 "paragraph_index": <integer>, "question": "<question or empty string>"}
```

The user message sent alongside it carries: topic, subject, word count, text stage, the numbered paragraphs of the draft, the previous draft version (for detecting surface-only revision), and the list of already-used issue categories / already-questioned paragraph indices to avoid repetition.

## 6. Enforcing the maximum number of questions

Three independent layers, so no single bug can flood the student:

1. **Client trigger gate** — the hook refuses to call the function unless: word count ≥ 100, a trigger event fired, the target paragraph has no prior question, `questionsUsed < 5`, and at least ~90s has passed since the last shown question.
2. **Server budget check** — `socratic-coach` re-reads `essays.coach_questions_used` and counts existing `coach_interventions` rows for the essay/paragraph. If over budget it returns `{intervene:false, suppressed_reason:"budget_essay"|"budget_paragraph"}` **without calling the model** (saves credits, and the client cannot lie).
3. **Atomic counter** — `coach_questions_used` is incremented in the same server call that returns a question, so races cannot yield a sixth question.

Suppressed attempts are still logged (with `question_shown = null`), which matters for the research data.

## 7. Preventing essay generation

- **Prompt-level**: the prohibitions block above, plus the single-question output contract.
- **Schema-level**: the model returns strict JSON with a single `question` string — there is no field in which prose could be delivered.
- **Server-side sanitiser** (runs before anything reaches the client). Reject and return `intervene:false` if the question:
  - is missing a `?`, or contains more than one `?`;
  - exceeds 30 words or 200 characters;
  - contains newlines, bullet markers, quotation blocks, or code fences;
  - does not begin with an interrogative opener (what / how / why / which / in what way / where / to what extent / how might);
  - contains generation phrases (`you could write`, `try writing`, `for example, "`, `here is`, `consider adding the sentence`, `rewrite it as`);
  - quotes more than 6 consecutive words of the student's own draft (verbatim-span check against the draft).
- **One retry, then silence**: on rejection the function retries once with a stricter reminder; a second failure logs `suppressed_reason:"uncertain"` and shows nothing. The student never sees rejected output.
- **No streaming to the client** — the client receives only the validated JSON, never raw model tokens.

## Out of scope for this iteration

- Teacher-facing analytics dashboard over `coach_interventions` (logging is built now; visualisation later).
- Changing the existing on-demand tutor chat behaviour.
- Any change to grading, annotations, or the timer.
