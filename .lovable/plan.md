# Advanced Teacher Tools — Implementation Plan

## 1. Database Migration

New table **`annotations`**
- `id`, `essay_id` (FK), `teacher_id`, `start_index` (int), `end_index` (int), `color_code` (text), `comment_text` (text), `created_at`, `updated_at`
- RLS: teachers (has_role 'teacher') can full-CRUD; students can SELECT annotations on their own essays.

New table **`evaluations`** (final feedback / grade — one per essay)
- `id`, `essay_id` (FK, unique), `teacher_id`, `grade` (text, e.g. "A" or "85/100"), `feedback` (text), `created_at`, `updated_at`
- RLS: teachers full-CRUD; students SELECT their own.

Add to **`essays`**:
- `ai_probability` (numeric, 0–100, nullable) — cached detector result
- `ai_checked_at` (timestamptz, nullable)

Add to **`profiles`** notification helper — actually use a derived flag: student dashboard reads `evaluations` joined with `essays` to show "Evaluated" badge (no extra table needed).

## 2. Edge Function: `detect-ai`
- Input: `{ essay_id }`
- Teacher-only (verify JWT + role).
- Calls **Lovable AI Gateway** (`google/gemini-2.5-flash`) with a strict prompt:
  "Return JSON `{probability: 0-100}` estimating likelihood text is AI-generated."
- Parses JSON, writes `ai_probability` + `ai_checked_at` to the essay row, returns the value.
- No external GPTZero key needed — uses already-configured `LOVABLE_API_KEY`.

## 3. Student Workspace — Lock on Submit
- Load `is_submitted` from essay; if true, render textarea as `readOnly`, disable AI Tutor input, hide "Submit & Exit" button, show **"Status: Submitted"** badge in the top bar.
- When 45-min timer reaches 0, auto-call `update essays set is_submitted=true` and flip UI to read-only.
- Auto-save effect skipped when submitted.

## 4. Teacher Review — Highlighting + Comments
Keep the lightweight stack (no TipTap dependency churn). Implement annotations over a `<div>` rendering of `essay.content`:
- Track text selection via `window.getSelection()` + a known container; compute `start_index`/`end_index` against the plain-text content.
- On selection, show a floating "Add Comment" button near the selection; clicking opens a small popover with textarea + color picker (4 preset colors) → inserts row into `annotations`.
- Render content by splicing annotation ranges into `<mark>` spans with `data-annotation-id` and background = `color_code`.
- **Sidebar**: list of comments. Clicking a comment → `scrollIntoView` on the matching mark + highlight pulse. Clicking a mark → scrolls/focuses its sidebar card.
- Delete button per comment (teacher only).

## 5. Teacher Review — AI Check + Final Feedback
- **"Check for AI"** button at top of review page → invokes `detect-ai` edge function, shows a **Progress bar** with label `"{n}% likely AI-generated"` (red >70, amber 40–70, green <40). Shows cached value with timestamp if already checked.
- **Final Feedback** section at the bottom: textarea for `feedback` + input for `grade` + "Save Evaluation" button (upserts into `evaluations`).

## 6. Student Dashboard — Evaluated Notification
- For each draft, join `evaluations`. If present, show a green **"Evaluated — View Feedback"** badge/button linking to a new read-only page `/feedback/:essayId` showing essay + annotations (read-only) + grade + feedback.

## 7. Routing
- New route `/feedback/:id` (student-only) — read-only essay with annotations highlighted and feedback panel.

## Technical Notes
- No TipTap install — using a custom highlight renderer keeps bundle small and works with existing plain-text content. If the user later wants rich text, we can migrate.
- AI detection uses Lovable AI (no extra secret).
- Indexes are computed against `essay.content` (plain text), which matches what the student typed.

## Out of Scope
- Realtime annotation collaboration between multiple teachers.
- Rich-text formatting in the editor.
