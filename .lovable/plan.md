# Proactive Socratic Coach — Isolated `research_mode` Layer (Plan v3)

Nothing has been changed yet. This plan supersedes v2 and adds the non-regression contract you asked for.

## 0. Guarantees

- **Nothing is deleted, renamed, or redesigned.** No table, column, RLS policy, database function, route, component, or edge function is removed or repurposed.
- Every new behaviour is behind `essays.research_mode = true` (new column, default `false`). With that flag false, the code paths are identical to today — the coach hook returns early before any state, effect, or render change.
- Existing essays all default to `research_mode = false`, so current student and teacher experience is untouched.
- The existing reactive tutor (`AITutorSidebar` + `ai-tutor` function) is **not modified in behaviour**; it only gains a `researchMode` prop that is `false` everywhere today.

### GitHub branch
I cannot create or switch git branches from here — git state is managed by the platform. If your project is GitHub-connected, please create `feature/research-socratic-coach` and switch the project to it in Settings → GitHub before approving; I will then implement only on that branch. If it is not connected, say so and I will implement in the project as usual.

## 1. Adjustments to v2 based on your constraints

| v2 item | Revised |
|---|---|
| New **Save paragraph** button | **Dropped.** Triggers reuse existing signals only: the existing save/draft actions and the existing 3 s `writing_events` snapshot loop, plus a blank-line paragraph boundary followed by an 8 s typing pause (detected from existing editor state — no new control). |
| New **Planning/Drafting/Revising/Final** control | **Dropped as a UI control.** `text_stage` is derived from existing user actions, not word count: `planning` = no save yet; `drafting` = after the first explicit save/first snapshot with content; `revising` = editing text that existed at the previous explicit save; `final` = after submit. Recorded as an action-derived value, still never inferred from word count. |
| Coach panel replacing the tutor | Only in research mode. Non-research essays render the tutor exactly as today. |

Everything else from v2 stands: four trigger events, ≥100 words as eligibility only, 1 question/paragraph, 5/essay, reflection logged with no AI reply, pseudonymous `P01…` codes, snapshot references instead of duplicated text, `revision_type` null by default, versioning fields, consent gate, pause control, unchanged JSON-only prompt and sanitiser.

## 2. Files that will be modified (existing files)

| File | Preserved exactly | Added / replaced |
|---|---|---|
| `src/pages/StudentWorkspace.tsx` | Editor, 5 s auto-save, 3 s `writing_events` logging, paste blocking, 45-min timer + auto-submit, `saveDraft`, `finalSubmit`, `requestSubmit`, discard, ExitModal, low-word dialog, all three mode branches, layout, styling | **Added:** read `research_mode` on load; render `<ResearchConsentDialog>` before the editor when `research_mode && !consented`; call `useSocraticCoach(...)` (no-op when flag false); pass `researchMode` to `AITutorSidebar`. No existing line's behaviour changes. |
| `src/components/AITutorSidebar.tsx` | Entire current chat implementation, streaming, persistence, quick prompts, styling | **Added:** optional `researchMode?: boolean` (default `false`) and a `coachSlot` render prop. When true, the chat composer/quick prompts are hidden and the coach panel renders in the same container. When false — today's exact render. |
| `supabase/config.toml` | All four existing function entries | **Added:** one `[functions.socratic-coach]` entry. |
| `src/i18n/locales/en.ts`, `ru.ts`, `kk.ts` | All existing keys | **Added:** a `coach.*` namespace (consent text, Answer/Not now/Skip, pause, helpfulness). No key removed or reworded. |
| `src/pages/TeacherReview.tsx` | Annotations, grading, AI check, playback, layout | **Added (optional, can be deferred):** a collapsed read-only "Coach activity" card, rendered only when the essay is research mode. Nothing existing touched. |

**No other existing file is modified.** `WritingPlayback.tsx`, `TeacherDashboard.tsx`, `StudentFeedback.tsx`, `ExitModal.tsx`, `ModeCards.tsx`, `App.tsx` routes, `SettingsContext`, and all four existing edge functions are untouched.

## 3. New files

- `supabase/functions/socratic-coach/index.ts` — JWT check, ownership check, server budget gate, model call, sanitiser, log write.
- `src/hooks/useSocraticCoach.ts` — trigger detection, budget, invocation, log updates. First line: `if (!researchMode) return inertState;`
- `src/components/SocraticPrompt.tsx` — question card: Answer / Not now / Skip, helpfulness control, reflection box.
- `src/components/ResearchConsentDialog.tsx` — consent gate.

## 4. Database changes (additive only)

**New tables** — `research_participants`, `coach_interventions`, `coach_pause_events` (fields exactly as in v2 §4, including `snapshot_before_id` / `snapshot_after_id` referencing `writing_events`, `target_paragraph_changed`, `revision_type` null by default, `intervention_version`, `system_prompt_version`, `model`, `model_version`, `question_helpfulness`, `coach_paused`, and `participant_code` pseudonyms).

**New nullable/defaulted columns on `essays`** — `research_mode` boolean default `false`, `coach_questions_used` int default `0`, `text_stage` text default `'planning'`.

No column, constraint, policy, index, trigger, or row is dropped or altered. Existing RLS policies stay as-is; new tables get their own policies plus explicit GRANTs in the same migration.

## 5. Diff summary (concise)

```text
NEW  supabase/functions/socratic-coach/index.ts     ~220 lines
NEW  src/hooks/useSocraticCoach.ts                  ~180 lines
NEW  src/components/SocraticPrompt.tsx              ~130 lines
NEW  src/components/ResearchConsentDialog.tsx        ~70 lines
MOD  src/pages/StudentWorkspace.tsx                 +~35 / -0   (consent gate, hook call, prop pass-through)
MOD  src/components/AITutorSidebar.tsx              +~20 / -0   (researchMode branch around composer)
MOD  supabase/config.toml                           +2  / -0
MOD  src/i18n/locales/{en,ru,kk}.ts                 +~18 each / -0
MOD  src/pages/TeacherReview.tsx (optional)         +~40 / -0
SQL  3 new tables, 3 new essay columns, RLS + GRANTs — additive only
DEL  (none)
```

Every `MOD` is additive: no existing lines are deleted, only new guarded blocks inserted.

## 6. Confirmation

No existing database table, column, function, trigger, RLS policy, route, component, edge function, style, or UI feature will be deleted or have its behaviour changed for non-research essays.

Approve and I will implement in this order: migration → edge function → hook/components → workspace wiring → i18n → verification.
