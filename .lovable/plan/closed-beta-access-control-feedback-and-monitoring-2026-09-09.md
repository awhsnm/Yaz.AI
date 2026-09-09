# Closed Beta: access control, feedback and monitoring

## A. Database tables and access rules

**`beta_allowlist`** — email, full_name, role (student/teacher), status (invited/active/disabled), invited_at, last_login_at, notes.
- Only admins can read the whole list or add/edit/remove rows.
- A signed-in person can check their own row only (matched on their own email), so nobody ever sees another person's email.

**`beta_feedback`** — user id, category (bug/confusing/suggestion/other), message, page URL, screenshot path, browser info, status (new/reviewing/resolved/closed), admin note, timestamps.
- Anyone signed in can send feedback and see only their own.
- Admins can see everything and change status.

**`error_logs`** — timestamp, user id (if known), page/feature, error message, browser & device info, severity.
- Written by any signed-in user (and anonymously for pre-login errors) but readable by admins only.

**`login_events`** — user id, timestamp, browser info. Used for the daily-logins chart. Admin-read only.

**Roles:** add an `admin` value to the existing role type and grant it to your account. Admin checks always run in the database, never in the browser.

**Storage:** a private `feedback-screenshots` bucket; users upload into their own folder, admins can read all.

**Indexes:** allowlist email (unique, lowercased), feedback (status, category, created_at), error logs (created_at, user), login events (created_at), plus existing per-user essay lookups.

## B. Flow for an invited beta tester

1. Opens the site, signs up or signs in with the email you invited (email confirmation still required).
2. On first successful sign-in, their allowlist row flips from "invited" to "active" and records the login time.
3. Email not on the list, or status "disabled": they see a calm full-page notice — "This platform is currently in a private beta. Please contact the administrator if you believe you should have access." — with a sign-out button and nothing else.
4. Approved testers use the platform exactly as today, plus a floating "Send Feedback" button on every signed-in page: category, message, optional screenshot; the page address and time are captured automatically.
5. If something breaks they see a friendly message ("Something went wrong on our side — we've logged it"), never technical detail; the detail goes to the error log.

## C. Admin workflow

- New admin area at `/admin` (invisible and blocked for everyone else): Users, Feedback, System Health.
- **Users:** paste or type an email + name + role to invite; table shows status and last login; buttons to activate, disable, re-enable, or remove. Bulk paste of up to 28 emails at once.
- **Feedback:** filter by category, status and date range; open an item to read the message and screenshot; set status to new / reviewing / resolved / closed and add a private note.
- **System Health:** active beta users, daily logins (last 14 days), feedback counts by status, recent errors and failed requests.

## D. What you need to provide

- The 28 invitee emails and names (can be added later through the admin page).
- Which account should be admin (your email) — I'll grant it once.
- Nothing else: database, storage, auth and rate limiting all run on the existing backend. No new external services or API keys.

## Implementation steps

1. Database migration: role addition, four tables, grants, row-level rules, indexes, storage bucket, and a secure function that resolves the current user's beta status.
2. Access gate: extend the auth hook with beta status + admin flag; add the private-beta notice page; wrap protected routes.
3. Admin area: layout + Users page.
4. Feedback: floating button, form with screenshot upload, admin feedback dashboard.
5. Logging: global error boundary, a shared `logError` helper used by data and AI calls, login event recording, System Health page.
6. Performance pass: paginate long lists (dashboards, feedback, errors), lazy-load admin and heavy pages, memoize hot components, add loading/empty/error states, and confirm indexes.
7. Abuse protection: per-user limits on feedback submissions and error logging, reuse the existing per-minute limiter for AI actions.

## Technical notes

- Admin checks use a `has_role(auth.uid(),'admin')` security-definer function inside policies; the client only mirrors it for navigation.
- Allowlist matching normalizes email to lowercase and trims whitespace.
- The beta gate lives in `ProtectedRoute` so every existing protected page inherits it; the landing and auth pages stay public.
- Route-level `React.lazy` for admin pages keeps the student bundle unchanged.
- Load testing: I recommend testing against a duplicate project rather than this one; I can't create a second backend for you, so if you want an isolated beta environment you'd need to duplicate the project first.
