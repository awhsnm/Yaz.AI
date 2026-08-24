import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ClipboardPaste, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  classify,
  diffRange,
  fmtDuration,
  KIND_COLOR,
  KIND_LABEL,
  type AnalysedEvent,
  type EventKind,
  type RawWritingEvent,
} from "./writing-playback-utils";

export type WritingEvent = RawWritingEvent;

const SPEEDS = [0.5, 1, 2, 4, 8];
const BASE_STEP_MS = 1200;
const LEGEND: EventKind[] = ["typing", "insertion", "deletion", "paste", "save", "submit", "pause"];

const WritingPlayback = ({
  essayId,
  open,
  onOpenChange,
  fallbackContent,
}: {
  essayId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fallbackContent: string;
}) => {
  const [events, setEvents] = useState<WritingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"key" | "all">("key");
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("writing_events")
        .select("id, at, snapshot, word_count, chars_added, is_paste")
        .eq("essay_id", essayId)
        .order("at");
      setEvents((data ?? []) as WritingEvent[]);
      setPos(0);
      setPlaying(false);
      setView("key");
      setLoading(false);
    })();
  }, [open, essayId]);

  const analysed = useMemo(() => classify(events), [events]);
  const keyEvents = useMemo(() => analysed.filter((e) => e.significant), [analysed]);
  const list: AnalysedEvent[] = view === "key" ? (keyEvents.length ? keyEvents : analysed) : analysed;

  useEffect(() => {
    setPos(0);
    setPlaying(false);
  }, [view]);

  const total = analysed.length ? analysed[analysed.length - 1].offset : 0;
  const current = list[Math.min(pos, Math.max(list.length - 1, 0))];
  const previous = pos > 0 ? list[pos - 1] : null;
  const pasteCount = analysed.filter((e) => e.kind === "paste").length;

  useEffect(() => {
    if (!playing || list.length === 0) return;
    if (pos >= list.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setPos((p) => p + 1), BASE_STEP_MS / speed);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [playing, pos, speed, list.length]);

  const jump = useCallback((i: number) => {
    setPlaying(false);
    setPos(i);
  }, []);

  // Highlight only the delta versus the previously *displayed* version.
  const rendered = useMemo(() => {
    if (!current) return null;
    const text = current.raw.snapshot ?? "";
    const prevText = previous?.raw.snapshot ?? "";
    const { start, endNext } = diffRange(prevText, text);
    if (endNext <= start) return { before: text, changed: "", after: "" };
    return { before: text.slice(0, start), changed: text.slice(start, endNext), after: text.slice(endNext) };
  }, [current, previous]);

  const deltaAdded = current && previous ? diffRange(previous.raw.snapshot ?? "", current.raw.snapshot ?? "").added : current?.added ?? 0;
  const deltaRemoved = current && previous ? diffRange(previous.raw.snapshot ?? "", current.raw.snapshot ?? "").removed : current?.removed ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display">Writing Playback</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground font-display py-10 text-center">Loading session timeline…</p>
        ) : events.length === 0 ? (
          <div className="py-8 space-y-3">
            <p className="text-sm text-muted-foreground font-display">
              No keystroke timeline was recorded for this essay (it was written before playback was enabled).
            </p>
            <div className="bg-muted/40 border border-border rounded-lg p-4 max-h-[40vh] overflow-y-auto whitespace-pre-wrap font-display text-sm">
              {fallbackContent}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* View switch */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label="Playback view">
                <Button
                  role="tab"
                  aria-selected={view === "key"}
                  size="sm"
                  variant={view === "key" ? "default" : "ghost"}
                  onClick={() => setView("key")}
                  className="font-display h-8"
                >
                  Key changes
                </Button>
                <Button
                  role="tab"
                  aria-selected={view === "all"}
                  size="sm"
                  variant={view === "all" ? "default" : "ghost"}
                  onClick={() => setView("all")}
                  className="font-display h-8"
                >
                  Detailed timeline
                </Button>
              </div>
              <span className="text-xs text-muted-foreground font-display">
                Showing {keyEvents.length} key changes out of {analysed.length} recorded snapshots.
              </span>
            </div>

            {/* Snapshot with delta highlight */}
            <div className="bg-card border border-border rounded-lg p-4 h-[45vh] overflow-y-auto whitespace-pre-wrap font-display text-sm leading-relaxed">
              {rendered?.before}
              {rendered?.changed ? (
                <mark className="bg-primary/20 text-foreground rounded-sm">{rendered.changed}</mark>
              ) : null}
              {rendered?.after}
              <span className="inline-block w-[2px] h-4 align-middle bg-primary animate-pulse ml-0.5" />
            </div>

            {/* Event meta */}
            {current && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-display text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <span className={`w-2 h-2 rounded-full ${KIND_COLOR[current.kind]}`} aria-hidden />
                  {KIND_LABEL[current.kind]}
                </span>
                <span>{new Date(current.raw.at).toLocaleTimeString()}</span>
                <span>Elapsed {fmtDuration(current.offset)} / {fmtDuration(total)}</span>
                <span>+{deltaAdded} / −{deltaRemoved} chars</span>
                <span>{current.raw.word_count} words</span>
                {current.gap >= 30 && <span>Pause {fmtDuration(current.gap)}</span>}
              </div>
            )}

            {/* Compact timeline with click-to-jump markers */}
            <div>
              <div className="relative h-6" role="group" aria-label="Event timeline">
                <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${list.length > 1 ? (pos / (list.length - 1)) * 100 : 0}%` }}
                  />
                </div>
                {list.map((e, i) => (
                  <button
                    key={e.raw.id}
                    type="button"
                    onClick={() => jump(i)}
                    style={{ left: `${list.length > 1 ? (i / (list.length - 1)) * 100 : 0}%` }}
                    aria-label={`Event ${i + 1} of ${list.length}: ${KIND_LABEL[e.kind]} at ${fmtDuration(e.offset)}`}
                    title={`${KIND_LABEL[e.kind]} • ${fmtDuration(e.offset)}`}
                    className={`absolute top-0 -translate-x-1/2 w-1.5 h-6 rounded-sm focus:outline-none focus:ring-2 focus:ring-ring ${KIND_COLOR[e.kind]} ${
                      i === pos ? "ring-2 ring-ring" : ""
                    }`}
                  />
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(list.length - 1, 0)}
                value={pos}
                onChange={(e) => jump(Number(e.target.value))}
                className="w-full accent-primary mt-1"
                aria-label={`Playback position: event ${pos + 1} of ${list.length}`}
              />
              <p className="text-xs text-muted-foreground font-display">
                Event {list.length ? pos + 1 : 0} of {list.length}
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (pos >= list.length - 1) setPos(0);
                  setPlaying((p) => !p);
                }}
                className="font-display"
                aria-label={playing ? "Pause playback" : "Play playback"}
              >
                {playing ? <><Pause className="w-4 h-4 mr-1" />Pause</> : <><Play className="w-4 h-4 mr-1" />Play</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => jump(Math.max(pos - 1, 0))} disabled={pos === 0} className="font-display" aria-label="Previous event">
                <ChevronLeft className="w-4 h-4 mr-1" />Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => jump(Math.min(pos + 1, list.length - 1))}
                disabled={pos >= list.length - 1}
                className="font-display"
                aria-label="Next event"
              >
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => jump(0)} className="font-display" aria-label="Restart playback">
                <RotateCcw className="w-4 h-4 mr-1" />Restart
              </Button>
              <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
                {SPEEDS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={speed === s ? "default" : "outline"}
                    onClick={() => setSpeed(s)}
                    aria-pressed={speed === s}
                    className="font-display h-8 px-2.5"
                  >
                    {s}×
                  </Button>
                ))}
              </div>
              <span className={`text-xs font-display inline-flex items-center gap-1 ml-auto ${pasteCount ? "text-destructive" : "text-muted-foreground"}`}>
                <ClipboardPaste className="w-3.5 h-3.5" />{pasteCount} paste event{pasteCount === 1 ? "" : "s"}
              </span>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-display text-muted-foreground">
              {LEGEND.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${KIND_COLOR[k]}`} aria-hidden />
                  {KIND_LABEL[k]}
                </span>
              ))}
            </div>

            <p className="text-xs text-muted-foreground font-display border-t border-border pt-3">
              Playback shows recorded editing activity in this workspace. It does not independently verify authorship or use of external tools.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WritingPlayback;
