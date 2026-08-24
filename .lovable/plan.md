# Writing Playback: Key Changes View

Scope: `src/components/WritingPlayback.tsx` only, plus one new helper file `src/components/writing-playback-utils.ts` used exclusively by it. No schema, no data collection, no student UI, no routing/permission changes.

## What exists today (and what gets replaced)

- Data fetch of `writing_events` (id, at, snapshot, word_count, chars_added, is_paste) — **kept unchanged**.
- `SPEEDS = [1,2,5,10]` — replaced with `0.5, 1, 2, 4, 8`.
- Auto-advance effect using real gaps clamped to 8s — replaced with a step timer based on a fixed base interval divided by speed, operating over the *selected view's* event list.
- Timeline showing only paste markers — replaced with a full marker strip typed by event kind.
- Snapshot panel rendering raw `current.snapshot` — replaced with the same panel plus inline highlight of the delta vs the previously displayed version.
- Footer meta line (time / words / paste count) — extended with event type, chars added/removed, elapsed time.
- Everything else (Dialog shell, fallback content when no events, loading state, styling tokens, props signature, default export) stays as is.

## Added behaviour

1. **Classification helper** (new file): for each snapshot compute vs previous — chars added/removed, new-paragraph detection (increase in `\n\n` blocks), paste flag, save/submit flag if inferable from the event, and pause length from timestamps. Significance = new paragraph OR ≥20 chars inserted/deleted OR paste OR save/submit OR ≥30s pause. Also produces a common-prefix/suffix diff range so only the changed span is highlighted (no full-text diff list).
2. **Two views** (tabs/segmented control): "Key changes" (default, filtered list) and "Detailed timeline" (all snapshots, no autoplay by default — play must be pressed).
3. **Counter line**: "Showing X key changes out of Y recorded snapshots."
4. **Controls**: play/pause, previous/next (moves within the active view's list), speed 0.5/1/2/4/8, range slider labelled "Event N of M", and click-to-jump markers.
5. **Marker legend**: typing/edit, major insertion, deletion, paste detected, save, submit, long pause — colour-coded via existing semantic tokens, each marker a focusable `button` with `aria-label`.
6. **Per-event detail**: timestamp, elapsed since start, event type badge, +added / -removed chars.
7. **Neutral note** at the bottom: "Playback shows recorded editing activity in this workspace. It does not independently verify authorship or use of external tools."

## Notes

- Save/submit markers are derived only from data already present on the event rows; if no such field exists, those marker types simply never appear — no collection changes are made.
- Keyboard: controls are real buttons/inputs; left/right arrows on the slider step events natively.
