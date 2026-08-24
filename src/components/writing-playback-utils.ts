export interface RawWritingEvent {
  id: string;
  at: string;
  snapshot: string;
  word_count: number;
  chars_added: number;
  is_paste: boolean;
  event_type?: string | null;
}

export type EventKind =
  | "typing"
  | "insertion"
  | "deletion"
  | "paste"
  | "save"
  | "submit"
  | "pause";

export interface AnalysedEvent {
  raw: RawWritingEvent;
  index: number;
  offset: number; // seconds since first event
  gap: number; // seconds since previous event
  added: number;
  removed: number;
  newParagraph: boolean;
  kind: EventKind;
  significant: boolean;
}

export const MIN_CHARS = 20;
export const MIN_PAUSE = 30;

const paragraphs = (t: string) => t.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;

/** Common prefix/suffix diff range so only the changed span is highlighted. */
export function diffRange(prev: string, next: string) {
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  return {
    start,
    endNext,
    added: Math.max(endNext - start, 0),
    removed: Math.max(endPrev - start, 0),
  };
}

export function classify(events: RawWritingEvent[]): AnalysedEvent[] {
  if (events.length === 0) return [];
  const t0 = new Date(events[0].at).getTime();

  return events.map((raw, i) => {
    const prev = i > 0 ? events[i - 1] : null;
    const prevText = prev?.snapshot ?? "";
    const text = raw.snapshot ?? "";
    const { added, removed } = diffRange(prevText, text);
    const offset = (new Date(raw.at).getTime() - t0) / 1000;
    const gap = prev ? (new Date(raw.at).getTime() - new Date(prev.at).getTime()) / 1000 : 0;
    const newParagraph = paragraphs(text) > paragraphs(prevText);
    const marker = (raw.event_type ?? "").toLowerCase();
    const isSubmit = marker.includes("submit");
    const isSave = !isSubmit && (marker.includes("save") || marker.includes("final"));

    let kind: EventKind = "typing";
    if (isSubmit) kind = "submit";
    else if (isSave) kind = "save";
    else if (raw.is_paste) kind = "paste";
    else if (gap >= MIN_PAUSE) kind = "pause";
    else if (removed >= MIN_CHARS && removed > added) kind = "deletion";
    else if (added >= MIN_CHARS || newParagraph) kind = "insertion";

    const significant =
      i === 0 ||
      newParagraph ||
      added >= MIN_CHARS ||
      removed >= MIN_CHARS ||
      raw.is_paste ||
      isSave ||
      isSubmit ||
      gap >= MIN_PAUSE;

    return { raw, index: i, offset, gap, added, removed, newParagraph, kind, significant };
  });
}

export const KIND_LABEL: Record<EventKind, string> = {
  typing: "Typing / minor edit",
  insertion: "Major insertion",
  deletion: "Deletion",
  paste: "Paste detected",
  save: "Save",
  submit: "Submit",
  pause: "Long pause",
};

/** Colour classes built on existing semantic tokens. */
export const KIND_COLOR: Record<EventKind, string> = {
  typing: "bg-muted-foreground/40",
  insertion: "bg-primary",
  deletion: "bg-accent-foreground/60",
  paste: "bg-destructive",
  save: "bg-secondary-foreground/70",
  submit: "bg-primary/70",
  pause: "bg-muted-foreground/70",
};

export const fmtDuration = (s: number) =>
  `${Math.floor(s / 60)}:${Math.floor(Math.max(s, 0) % 60).toString().padStart(2, "0")}`;
