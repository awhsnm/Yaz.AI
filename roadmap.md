# Roadmap

## Done
- [x] Fix QA finding: wrong lesson code showed "Class joined" in EssaySharingMenu (empty RPC result now treated as failure) — resolved as fixed.

## In progress
- [ ] AI Interaction Analytics (user-uploaded spec, 286 lines):
  - [ ] DB: ai_interactions + focus_events tables with RLS (admin read, server write), grants
  - [ ] Capture AI interactions in ai-tutor edge function (student message, AI response, context)
  - [ ] LLM-based classification (not keyword-only): primary_category, confidence, reason
  - [ ] Client focus-event tracking in StudentWorkspace (tab/window/writing/pause/AI-open events, batched)
  - [ ] Derived metrics: focus sessions, active focus time, resume-after-AI, per-essay aggregates
  - [ ] Admin page /admin/ai-interactions: overview, per-student, essay timeline, 10 charts, filters
  - [ ] Research export CSV: student×essay dataset + interaction-level dataset
  - [ ] No single engagement score; raw events and derived metrics kept separate
