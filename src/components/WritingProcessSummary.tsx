import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EventRow {
  at: string;
  word_count: number;
  chars_added: number;
  is_paste: boolean;
  event_type: string | null;
}

interface PromptRow {
  created_at: string;
  word_count: number;
  question_shown: string | null;
  user_action: string | null;
}

interface ReflectionRow {
  argument_decision: string | null;
  revision_note: string | null;
  outside_support: string;
  outside_support_note: string | null;
}

const SUPPORT_LABEL: Record<string, string> = {
  none: "No outside support",
  class_materials: "Teacher-approved class materials",
  dictionary_translation: "Dictionary or translation support",
  other: "Other (described by the student)",
};

const fmt = (iso: string) => new Date(iso).toLocaleString();

const duration = (a: string, b: string) => {
  const mins = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

/**
 * Teacher-only process facts. Descriptive only — no score, no accusation,
 * and no claim that authorship or external tool use can be verified.
 */
const WritingProcessSummary = ({ essayId }: { essayId: string }) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [reflection, setReflection] = useState<ReflectionRow | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: ev }, { data: essay }, { data: ci }, { data: refl }] = await Promise.all([
        supabase
          .from("writing_events")
          .select("at, word_count, chars_added, is_paste, event_type")
          .eq("essay_id", essayId)
          .order("at"),
        supabase.from("essays").select("submitted_at, created_at").eq("id", essayId).maybeSingle(),
        supabase
          .from("coach_interventions")
          .select("created_at, word_count, question_shown, user_action")
          .eq("essay_id", essayId)
          .not("question_shown", "is", null)
          .order("created_at"),
        supabase
          .from("essay_reflections")
          .select("argument_decision, revision_note, outside_support, outside_support_note")
          .eq("essay_id", essayId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setEvents((ev ?? []) as EventRow[]);
      setPrompts((ci ?? []) as PromptRow[]);
      setReflection((refl ?? null) as ReflectionRow | null);
      setSubmittedAt(
        ((essay as { submitted_at?: string | null } | null)?.submitted_at) ?? null,
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [essayId]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 text-sm font-display text-muted-foreground">
        Loading writing-process data…
      </div>
    );
  }

  const start = events[0]?.at ?? null;
  const last = events[events.length - 1]?.at ?? null;
  const pasteCount = events.filter((e) => e.is_paste).length;
  const majorInsertions = events.filter((e) => e.chars_added >= 80).length;
  const majorDeletions = events.filter((e) => e.chars_added <= -80).length;
  const peakWords = events.reduce((m, e) => Math.max(m, e.word_count ?? 0), 0);

  // A light word-count-over-time strip (max 40 buckets).
  const step = Math.max(1, Math.ceil(events.length / 40));
  const series = events.filter((_, i) => i % step === 0);

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />Writing process
      </h2>

      {events.length === 0 ? (
        <p className="text-sm font-display text-muted-foreground">
          No process data was recorded for this essay.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm font-display">
            <div><dt className="text-muted-foreground text-xs">Started</dt><dd className="text-foreground">{start ? fmt(start) : "–"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Submitted</dt><dd className="text-foreground">{submittedAt ? fmt(submittedAt) : "Not submitted"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Time in workspace</dt><dd className="text-foreground">{start && last ? duration(start, submittedAt ?? last) : "–"}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Words (peak)</dt><dd className="text-foreground">{peakWords}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Clipboard pastes</dt><dd className="text-foreground">{pasteCount}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Major insertions / deletions</dt><dd className="text-foreground">{majorInsertions} / {majorDeletions}</dd></div>
          </dl>

          <div>
            <p className="text-xs font-display text-muted-foreground mb-1">Word count over time</p>
            <div className="flex items-end gap-0.5 h-12" aria-hidden>
              {series.map((e, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/30 rounded-t-sm"
                  style={{ height: `${peakWords ? Math.max(2, (e.word_count / peakWords) * 100) : 2}%` }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {prompts.length > 0 && (
        <div>
          <p className="text-xs font-display text-muted-foreground mb-1">Coach questions shown</p>
          <ul className="space-y-1.5">
            {prompts.map((p, i) => (
              <li key={i} className="text-sm font-display text-foreground">
                {p.question_shown}
                <span className="block text-xs text-muted-foreground">
                  {fmt(p.created_at)} · {p.word_count} words · student action: {p.user_action ?? "no response"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reflection && (
        <div className="space-y-1">
          <p className="text-xs font-display text-muted-foreground">Student reflection</p>
          {reflection.argument_decision && (
            <p className="text-sm font-display text-foreground">{reflection.argument_decision}</p>
          )}
          {reflection.revision_note && (
            <p className="text-sm font-display text-foreground">{reflection.revision_note}</p>
          )}
          <p className="text-xs font-display text-muted-foreground">
            Outside support: {SUPPORT_LABEL[reflection.outside_support] ?? reflection.outside_support}
            {reflection.outside_support_note ? ` — ${reflection.outside_support_note}` : ""}
          </p>
        </div>
      )}

      <p className="text-xs font-display text-muted-foreground border-t border-border pt-3">
        Writing-process data reflects recorded activity in this workspace. It does not independently
        verify authorship or use of external tools.
      </p>
    </div>
  );
};

export default WritingProcessSummary;
