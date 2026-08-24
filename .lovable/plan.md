# Invitation-Only Research Pilot (isolated)

A hidden `/research-pilot` route gated by a server-validated invite code. Everything research-related lives behind that gate; the public product is untouched.

## Flow

```text
/research-pilot  ->  invite code form
      |  (server validates code)
      v
 participant code assigned (P01, P02, ...)
      v
 consent screen  ->  essay created with research_mode = true
      v
 writing: proactive Socratic coach ON, reactive AI tutor OFF
      v
 final submission  ->  post-writing questionnaire  ->  thank-you
```

## Files that would change

New:
- `src/pages/ResearchPilot.tsx` — hidden entry page: internal note, invite-code form, consent step, "start / continue session" action.
- `src/components/ResearchQuestionnaire.tsx` — post-submission feedback questionnaire (Likert + short text).
- `supabase/functions/research-invite/index.ts` — validates the invite code against a secret and issues the pilot essay.

Edited:
- `src/App.tsx` — register `/research-pilot` route (student-protected), plus `/research-pilot/done` questionnaire step if needed.
- `src/pages/StudentWorkspace.tsx` — after final submit of a `research_mode` essay, show the questionnaire instead of the normal redirect. All new logic inside the existing `if (researchMode)` branches; non-research paths untouched.
- `src/i18n/locales/en.ts`, `ru.ts`, `kk.ts` — strings for the pilot page and questionnaire, under a `research.*` namespace.

Not touched: `Landing.tsx`, `Auth.tsx`, navigation/footer components, `TeacherDashboard.tsx`, `TeacherReview.tsx`, `ModeCards.tsx`, `AITutorSidebar.tsx`, `robots.txt`, `index.html`.

Database: one new table `research_questionnaires` (essay_id, participant_id, answers jsonb) with row-level rules restricting each student to their own rows, plus grants. No changes to existing tables.

## How invite-code validation is secured

- The code lives only as a backend secret (`RESEARCH_PILOT_INVITE_CODE`, first value `PILOT2026`). Never in client source, `.env`, or the bundle.
- The client posts the entered code to the `research-invite` edge function with the user's auth token. The function compares it (constant-time) to the secret and, on success, ensures the participant record and creates/returns the pilot essay with `research_mode = true`. On failure it returns a generic error.
- Rate limiting: failed attempts throttled per user (short cooldown after 5 failures) to block guessing.
- The code itself is never returned to the client, and the client cannot set `research_mode` on its own — the function is the only writer of that flag.

## How the route stays out of public navigation

- Route registered only in `src/App.tsx`; no `Link`, menu item, footer entry, or CTA references it anywhere.
- `robots.txt` stays as is (it already has no sitemap listing the path); the page renders `<meta name="robots" content="noindex, nofollow">`.
- Without a valid code the page shows only the invite form and the internal note — no research copy, no participant code.

## How ordinary users stay non-research

- `research_mode` defaults to `false` and only the edge function ever sets it true.
- Consent dialog, participant code, Socratic coach, and questionnaire all render behind the existing `researchMode` check in `StudentWorkspace.tsx`; nothing moves outside it.
- Reactive tutor vs proactive coach selection already keys off `researchMode` — unchanged for classroom/solo/brainstorm.
- Dashboard, teacher views, and mode cards get no new research UI, so a pilot essay simply looks like a normal draft to existing screens.

## Internal note

Shown only on `/research-pilot`: "This invitation-only pilot records pseudonymised writing and interaction data for research purposes."

## Rollback plan

1. Remove the `/research-pilot` route line from `src/App.tsx` — the entire pilot becomes unreachable instantly, with zero effect on the public product.
2. Delete the `research-invite` edge function and clear the invite-code secret to disable code validation.
3. Delete `ResearchPilot.tsx`, `ResearchQuestionnaire.tsx`, and revert the `StudentWorkspace.tsx` research branch and i18n additions.
4. Data: `research_questionnaires` can be dropped; existing pilot essays can be flipped to `research_mode = false` to return them to normal behaviour.
