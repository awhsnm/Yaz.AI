import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export interface WritingEvent {
  id: string;
  at: string;
  snapshot: string;
  word_count: number;
  chars_added: number;
  is_paste: boolean;
}

const SPEEDS = [1, 2, 5, 10];

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
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
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
      setIndex(0);
      setPlaying(false);
      setLoading(false);
    })();
  }, [open, essayId]);

  // Real elapsed offsets (seconds) for each event
  const offsets = useMemo(() => {
    if (events.length === 0) return [] as number[];
    const t0 = new Date(events[0].at).getTime();
    return events.map((e) => (new Date(e.at).getTime() - t0) / 1000);
  }, [events]);

  const total = offsets.length ? offsets[offsets.length - 1] : 0;

  useEffect(() => {
    if (!playing || events.length === 0) return;
    if (index >= events.length - 1) { setPlaying(false); return; }
    const gap = Math.min(Math.max(offsets[index + 1] - offsets[index], 0.2), 8);
    timer.current = window.setTimeout(() => setIndex((i) => i + 1), (gap * 1000) / speed);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [playing, index, speed, events.length, offsets]);

  const current = events[index];
  const pasteCount = events.filter((e) => e.is_paste).length;
  const progress = total > 0 ? (offsets[index] / total) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

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
            <div className="bg-card border border-border rounded-lg p-4 h-[45vh] overflow-y-auto whitespace-pre-wrap font-display text-sm leading-relaxed">
              {current?.snapshot}
              <span className="inline-block w-[2px] h-4 align-middle bg-primary animate-pulse ml-0.5" />
            </div>

            {/* Timeline */}
            <div>
              <div className="relative h-6">
                <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                {events.map((e, i) =>
                  e.is_paste ? (
                    <button
                      key={e.id}
                      title={`Paste event (+${e.chars_added} chars)`}
                      onClick={() => setIndex(i)}
                      style={{ left: `${total > 0 ? (offsets[i] / total) * 100 : 0}%` }}
                      className="absolute top-0 -translate-x-1/2 w-1.5 h-6 rounded-sm bg-destructive"
                    />
                  ) : null
                )}
              </div>
              <input
                type="range"
                min={0}
                max={events.length - 1}
                value={index}
                onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
                className="w-full accent-primary mt-1"
                aria-label="Playback position"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => { if (index >= events.length - 1) setIndex(0); setPlaying((p) => !p); }} className="font-display">
                {playing ? <><Pause className="w-4 h-4 mr-1" />Pause</> : <><Play className="w-4 h-4 mr-1" />Play</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setIndex(0); }} className="font-display">
                <RotateCcw className="w-4 h-4 mr-1" />Restart
              </Button>
              <div className="flex items-center gap-1">
                {SPEEDS.map((s) => (
                  <Button key={s} size="sm" variant={speed === s ? "default" : "outline"} onClick={() => setSpeed(s)} className="font-display h-8 px-2.5">
                    {s}x
                  </Button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground font-display ml-auto">
                {fmt(offsets[index] ?? 0)} / {fmt(total)} • {current?.word_count ?? 0} words
              </span>
              <span className={`text-xs font-display inline-flex items-center gap-1 ${pasteCount ? "text-destructive" : "text-muted-foreground"}`}>
                <ClipboardPaste className="w-3.5 h-3.5" />{pasteCount} paste event{pasteCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WritingPlayback;
