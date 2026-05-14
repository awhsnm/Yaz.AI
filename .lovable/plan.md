# Implementation Plan

## 1. Database Migration
Add two new tables (profiles already exists with role column):

- **essays**: `id`, `student_id` (FK profiles.id), `topic`, `subject`, `content`, `is_submitted` (default false), `created_at`, `updated_at`
- **messages**: `id`, `essay_id` (FK essays.id), `content`, `sender` ('user'|'ai'), `created_at`

RLS policies:
- Students: full CRUD on their own essays/messages
- Teachers: SELECT on all essays/messages (uses existing `has_role()` function)
- Trigger to auto-update `essays.updated_at`

## 2. Authentication Wall
- Replace landing page (`/`) with unified **Login / Sign-up** form
- Sign-up includes Role toggle (Teacher / Student) + Full name + School
- On signup, pass `role` and `full_name` in user metadata (already wired into `handle_new_user` trigger)
- Email/password auth, with `emailRedirectTo: window.location.origin`
- Protected routes: redirect unauthenticated users to `/`

## 3. Routing & Redirection
- `/` — Auth page (login/signup)
- `/teacher-dashboard` — teachers only
- `/student-dashboard` — students only
- After login, look up role from `user_roles` and redirect accordingly
- `/essay/:id` — locked writing environment (existing flow), now requires essay_id

## 4. Teacher Dashboard
- List all essays (joined with student profile name) with search bar (filter by student name / topic / subject)
- Click essay → review mode showing final content + full chat log

## 5. Student Dashboard
- "Start New Essay" button → creates essay row, navigates to `/essay/:id`
- List of previous drafts with status (draft/submitted), resume link

## 6. AI Chat Persistence
- Existing `chat-with-ai` edge function + `AITutor` component
- Require `essay_id` prop; refuse to call AI without it
- After each AI response streams in, INSERT both the user message and the AI response into `messages` table
- On essay open, hydrate chat history from `messages` table

## 7. Auto-save Essay Content
- Existing 5s autosave updates `essays.content` in DB instead of localStorage (keep localStorage as offline fallback)

## Technical Notes
- Use existing `has_role(auth.uid(), 'teacher'::app_role)` in RLS
- Auth state via `onAuthStateChange` listener set up before `getSession`
- All new colors via existing semantic tokens (Tamos blue-gray)
- Teacher review mode is read-only

## Out of Scope (existing already)
- profiles + user_roles tables (done)
- handle_new_user trigger (done)
- Anthropic edge function (done)
