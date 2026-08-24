# Dynamic Proactive Socratic AI Coach — Revised Plan (v2)

No code, schema, UI, or deployment changes have been made. Plan only.
Revisions 1–10 from your review are incorporated below.

## 1. What already exists

- **Workspace** (`src/pages/StudentWorkspace.tsx`): draft state, 5s auto-save to `essays.content`, 3s snapshot logging to `writing_events` (with paste flag), timer, submit/lock, three modes.
- **Reactive tutor** (`src/components/AITutorSidebar.tsx` + `supabase/functions/ai-tutor`): student-initiated Socratic chat with no-ghostwriting rules.
- **Other functions**: `essay-feedback`, `generate-topics`, `detect-ai`, `extract-image-text`.
- **Tables**: `profiles`, `essays`, `messages`, `annotations`, `evaluations`, `classrooms`, `user_roles`, `writing_events`, `bug_reports`; helpers `has_role()`, `teacher_owns_essay_classroom()`.
- **`writing_events` already stores versioned full-text snapshots** — this becomes the single source of draft text for the research log (revision 3).

Missing: proactive analysis, intervention budgeting, research consent, participant pseudonyms, and the intervention log.

## 2. Revised architecture

### 2.1 Trigger model (revision 1)
Reaching 100 words is an **eligibility condition only** and never fires a question. Analysis is permitted only on one of four explicit events:

| `trigger_event` | Definition |
|---|---|
| `paragraph_saved` | Student clicks the new **Save paragraph** button next to the editor |
| `paragraph_boundary_pause` | A blank line completes a paragraph **and** typing stops for ≥ 8 s |
| `first_draft_save` | The first explicit "Save draft" of the session |
| `revision_mode_entered` | Student switches the stage control to **Revising** |

All four additionally require: word count ≥ 100, coach not paused, budget available, ≥ 90 s since the last shown question, target paragraph not already questioned.

### 2.2 Analysis service
New Edge Function **`socratic-coach`** (JWT-verified, student must own the essay):
1. Re-checks budget server-side and reads the two most recent `writing_events` snapshot IDs for the essay.
2. Sends draft + paragraph map + already-used categories/paragraphs to the model as strict JSON (prompt unchanged from v1, preserved per revision 10).
3. Sanitises the output server-side (rules unchanged, revision 10). One strict retry, then silence.
4. Writes the `coach_interventions` row, increments the budget counter atomically, returns only the validated question.
No streaming to the client; the browser never sees raw model tokens.

### 2.3 Research mode behaviour (revision 2)
- The reflection box **only** writes `reflection_response` into the intervention log. No model call, no message inserted into `messages`, no AI reply. The card closes with a neutral "Saved" state.
- **The on-demand AI tutor sidebar is disabled while an essay is in research mode.** In its place the sidebar shows the coach card, the pause control, and the questions-remaining counter. This removes the confound of a second, unlogged AI channel; no separate logging procedure for the reactive tutor is required.
- Non-research essays keep the current tutor unchanged.

### 2.4 Consent gate (revision 8)
Before the editor mounts for a research-mode essay, a blocking dialog shows:

> "I understand that my essay drafts, AI questions, reflections, and writing activity will be recorded for a research pilot. I will not include personal, confidential, or identifying information in my essay."

An unchecked checkbox plus an explicit **I agree** button; **Decline** returns to the dashboard. Consent (timestamp + prompt version) is stored on the participant record. Writing cannot begin without it.

### 2.5 Stage control (revision 5)
A visible 4-state segmented control — **Planning / Drafting / Revising / Final** — owned by the student. `text_stage` is recorded from that control only; word count is never used to infer stage. Changing to Revising is itself a trigger event.

### 2.6 Pause control (revision 9)
A **Pause coach prompts** toggle in the sidebar. While paused, no analysis runs. Each toggle writes a `coach_pause_events` row (`paused` true/false, timestamp, word count), and every intervention row carries the `coach_paused` state at trigger time.

## 3. Files changed or created

| File | Change |
|---|---|
| `supabase/functions/socratic-coach/index.ts` | new — analysis, sanitiser, budget, logging |
| `supabase/config.toml` | new function entry (`verify_jwt = true`) |
| `src/hooks/useSocraticCoach.ts` | new — trigger detection, budget, invocation, log updates |
| `src/components/SocraticPrompt.tsx` | new — question card: Answer / Not now / Skip + helpfulness control |
| `src/components/ResearchConsentDialog.tsx` | new — consent gate |
| `src/components/StageControl.tsx` | new — Planning/Drafting/Revising/Final |
| `src/pages/StudentWorkspace.tsx` | wire consent, stage, Save paragraph, coach hook; suppress tutor in research mode |
| `src/components/AITutorSidebar.tsx` | accept `researchMode` → render coach panel instead of chat |
| `src/i18n/locales/{en,ru,kk}.ts` | consent text, card controls, stage labels, pause label |
| `src/pages/TeacherReview.tsx` | *(later)* read-only view of coach activity |

## 4. Revised schema

**`research_participants`** (revision 4 — pseudonymisation)
`id` uuid pk · `user_id` uuid unique (internal only, never exported) · `participant_code` text unique (`P01`, `P02`, … assigned sequentially by a security-definer function) · `consented_at` timestamptz · `consent_version` text · `created_at`.
Exports join on `participant_code` only; `user_id` is excluded from every research view.

**`coach_interventions`**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `essay_id` | uuid fk → essays | |
| `participant_id` | uuid fk → research_participants | pseudonymous; no account id |
| `created_at` | timestamptz | |
| `text_stage` | text | `planning` \| `drafting` \| `revising` \| `final` — from the student control (rev. 5) |
| `word_count` | int | at trigger time |
| `trigger_event` | text | one of the four in §2.1 (rev. 1) |
| `issue_category` | text | one of nine, or `none` |
| `paragraph_index` | int | |
| `question_shown` | text | null when suppressed |
| `suppressed_reason` | text | `uncertain` \| `budget_essay` \| `budget_paragraph` \| `sanitiser_reject` \| null |
| `user_action` | text | `answered` \| `not_now` \| `skipped` \| `ignored` |
| `reflection_response` | text | nullable; log-only (rev. 2) |
| `snapshot_before_id` | uuid fk → writing_events | reference, no duplicated text (rev. 3) |
| `snapshot_after_id` | uuid fk → writing_events | nullable; first snapshot after the action |
| `target_paragraph_changed` | boolean | nullable; mechanical diff only (rev. 6) |
| `revision_type` | text | **null by default** — researcher-coded later (rev. 6) |
| `intervention_version` | text | rev. 7 |
| `system_prompt_version` | text | rev. 7 |
| `model` | text | rev. 7 |
| `model_version` | text | nullable, rev. 7 |
| `question_helpfulness` | text | `helpful` \| `not_helpful` \| `not_sure` \| null (rev. 7) |
| `coach_paused` | boolean | state at trigger time (rev. 7) |

Suppressed interventions store the snapshot **reference** only — never essay text.

**`coach_pause_events`**: `id`, `essay_id`, `participant_id`, `paused` bool, `word_count`, `created_at`.

**`essays`** gains: `research_mode` bool default false, `coach_questions_used` int default 0, `text_stage` text default `'planning'`.

RLS on all three new tables: student full access to their own rows (via the participant record), teachers select for essays in classrooms they own, `service_role` full; explicit `GRANT`s in the same migration.

## 5. System prompt (unchanged — revision 10)

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

The prompt string is versioned (`system_prompt_version`, e.g. `sp-1.0.0`) and stored on every intervention row.

## 6. Enforcing the question maximum

1. **Client gate** — one of the four trigger events, plus ≥100 words, unpaused, paragraph unquestioned, `questionsUsed < 5`, ≥90 s cooldown.
2. **Server gate** — `socratic-coach` recounts `coach_interventions` for the essay and paragraph and reads `essays.coach_questions_used`; over budget → returns `intervene:false` with a `suppressed_reason` **without calling the model**.
3. **Atomic counter** — the increment happens in the same server call that returns a question, so concurrent triggers cannot produce a sixth question.
Suppressed attempts are still logged (question null, snapshot reference only).

## 7. Preventing essay generation (unchanged — revision 10)

Prompt prohibitions + JSON-only contract (no field can carry prose) + server-side sanitiser rejecting output that: lacks or repeats `?`; exceeds 30 words / 200 chars; contains newlines, bullets, quote blocks or code fences; does not open with an interrogative; contains generation phrases (`you could write`, `try writing`, `here is`, `rewrite it as`, …); or quotes >6 consecutive words of the student's draft. One strict retry, then silence — rejected output never reaches the student and is logged as `sanitiser_reject`.

## 8. Out of scope

- Teacher analytics dashboard over the log (logging built now, visualisation later).
- Researcher coding UI for `revision_type` (exported CSV/SQL for now).
- Any change to grading, annotations, timer, or the non-research tutor experience.
