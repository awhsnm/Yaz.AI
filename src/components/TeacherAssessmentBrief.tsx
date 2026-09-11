import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  essayId: string;
  isSubmitted: boolean;
  studentName?: string | null;
  classroomName?: string | null;
  assignmentTitle?: string | null;
  essayTitle?: string | null;
  onOpenPlayback?: () => void;
}

type Item = { title?: string; evidence?: string; explanation?: string; paragraph_index?: number };

interface Assessment {
  generated_at: string;
  assessment_confidence: string | null;
  ideas_reasoning_score: number | null; ideas_reasoning_confidence: string | null; ideas_reasoning_rationale: string | null;
  organization_score: number | null; organization_confidence: string | null; organization_rationale: string | null;
  voice_score: number | null; voice_confidence: string | null; voice_rationale: string | null;
  word_choice_clarity_score: number | null; word_choice_clarity_confidence: string | null; word_choice_clarity_rationale: string | null;
  sentence_fluency_score: number | null; sentence_fluency_confidence: string | null; sentence_fluency_rationale: string | null;
  conventions_score: number | null; conventions_confidence: string | null; conventions_rationale: string | null;
  strongest_arguments: Item[] | null;
  priority_improvement_areas: Item[] | null;
  possible_teacher_questions: string[] | null;
  writing_duration_seconds: number | null;
  final_word_count: number | null;
  paragraph_count: number | null;
  meaningful_revision_count: number | null;
  submitted_at: string | null;
  ai_questions_shown: number | null;
  ai_questions_answered: number | null;
  ai_questions_skipped: number | null;
  ai_questions_not_now: number | null;
  ai_coach_paused: boolean | null;
  ai_prompt_topics: string[] | null;
  ai_support_label: string | null;
  ai_support_interpretation: string | null;
  ai_suggested_revision_type: string | null;
  ai_revision_confidence: string | null;
}

const PROVISIONAL = "AI provisional assessment — teacher review required.";

const Trait = ({ label, score, confidence, rationale }: { label: string; score: number | null; confidence: string | null; rationale: string | null }) => (
  <div className="border border-border rounded-md p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="font-display font-medium text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="font-display text-xs">
          {score === null ? "Not enough evidence" : `${score} / 6`}
        </Badge>
        {confidence && <span className="text-[11px] font-display text-muted-foreground">{confidence} confidence</span>}
      </div>
    </div>
    {rationale && <p className="text-sm font-display text-muted-foreground mt-1.5">{rationale}</p>}
  </div>
);

const TeacherAssessmentBrief = ({ essayId, isSubmitted, studentName, classroomName, assignmentTitle, essayTitle, onOpenPlayback }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Assessment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: row } = await supabase
      .from("essay_teacher_assessments")
      .select("*")
      .eq("essay_id", essayId)
      .maybeSingle();
    setData((row as unknown as Assessment) ?? null);
    setLoading(false);
  }, [essayId]);

  useEffect(() => { void load(); }, [load]);

  const generate = async (force = false) => {
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("generate-essay-feedback", {
        body: { essay_id: essayId, output_type: "both", force },
      });
      if (error) throw new Error((res as { error?: string } | null)?.error || error.message);
      if ((res as { error?: string } | null)?.error) throw new Error((res as { error: string }).error);
      const unusable = (res as { unusable_submission?: { message?: string } } | null)?.unusable_submission;
      if (unusable) {
        toast({ title: "Not an essay submission", description: unusable.message });
        setBusy(false);
        return;
      }
      await load();
      toast({ title: force ? "Brief regenerated" : "Brief ready" });
    } catch (err) {
      toast({ title: "Could not prepare the brief", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!isSubmitted) return null;

  return (
    <section className="bg-card border border-border rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span className="font-display font-semibold text-foreground">AI Assessment Brief</span>
        <Badge variant="outline" className="font-display text-[11px] ml-1">Teacher only</Badge>
        <span className="ml-auto text-xs font-display text-muted-foreground">
          {loading ? "" : data ? `Prepared ${new Date(data.generated_at).toLocaleString()}` : "Not prepared yet"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
          <p className="text-xs font-display font-medium text-warning">{PROVISIONAL}</p>

          {loading ? (
            <p className="text-sm font-display text-muted-foreground">Loading…</p>
          ) : !data ? (
            <div className="space-y-3">
              <p className="text-sm font-display text-muted-foreground">
                No brief has been prepared for this essay yet.
              </p>
              <Button onClick={() => generate(false)} disabled={busy} className="font-display">
                <Sparkles className="w-4 h-4 mr-1" />{busy ? "Preparing…" : "Prepare AI Assessment Brief"}
              </Button>
            </div>
          ) : (
            <>
              {/* A. Overview */}
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-2">Essay overview</h3>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm font-display">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Student</dt><dd>{studentName ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Classroom</dt><dd>{classroomName ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Assignment</dt><dd className="truncate">{assignmentTitle ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Essay title</dt><dd className="truncate">{essayTitle ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Submitted</dt><dd>{data.submitted_at ? new Date(data.submitted_at).toLocaleString() : "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd>Submitted</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Word count</dt><dd>{data.final_word_count ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Paragraphs</dt><dd>{data.paragraph_count ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Writing duration</dt><dd>{data.writing_duration_seconds ? `${Math.round(data.writing_duration_seconds / 60)} min` : "Not available"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Meaningful revisions</dt><dd>{data.meaningful_revision_count ?? "Not available"}</dd></div>
                </dl>
              </div>

              {/* B. Rubric */}
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-1">Provisional analytic rubric</h3>
                <p className="text-xs font-display text-muted-foreground mb-2">{PROVISIONAL} Overall confidence: {data.assessment_confidence ?? "—"}.</p>
                <div className="space-y-2">
                  <Trait label="Ideas and reasoning" score={data.ideas_reasoning_score} confidence={data.ideas_reasoning_confidence} rationale={data.ideas_reasoning_rationale} />
                  <Trait label="Organization" score={data.organization_score} confidence={data.organization_confidence} rationale={data.organization_rationale} />
                  <Trait label="Voice and audience awareness" score={data.voice_score} confidence={data.voice_confidence} rationale={data.voice_rationale} />
                  <Trait label="Word choice and clarity" score={data.word_choice_clarity_score} confidence={data.word_choice_clarity_confidence} rationale={data.word_choice_clarity_rationale} />
                  <Trait label="Sentence fluency" score={data.sentence_fluency_score} confidence={data.sentence_fluency_confidence} rationale={data.sentence_fluency_rationale} />
                  <Trait label="Conventions" score={data.conventions_score} confidence={data.conventions_confidence} rationale={data.conventions_rationale} />
                  <div className="border border-dashed border-border rounded-md p-3 text-sm font-display text-muted-foreground">
                    Presentation — Not assessed (no formatting or layout data is recorded).
                  </div>
                </div>
              </div>

              {/* C. Strongest */}
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-2">Strongest arguments and writing moves</h3>
                <ul className="space-y-2">
                  {(data.strongest_arguments ?? []).map((it, i) => (
                    <li key={i} className="text-sm font-display">
                      <span className="font-medium text-foreground">{it.title}</span>
                      {typeof it.paragraph_index === "number" && <span className="text-xs text-muted-foreground"> · Paragraph {it.paragraph_index}</span>}
                      {it.evidence && <p className="text-muted-foreground">{it.evidence}</p>}
                    </li>
                  ))}
                  {(data.strongest_arguments ?? []).length === 0 && <li className="text-sm font-display text-muted-foreground">Not available.</li>}
                </ul>
              </div>

              {/* D. Priority areas */}
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-2">Priority areas for teacher review</h3>
                <ul className="space-y-2">
                  {(data.priority_improvement_areas ?? []).map((it, i) => (
                    <li key={i} className="text-sm font-display">
                      <span className="font-medium text-foreground">{it.title}</span>
                      {typeof it.paragraph_index === "number" && <span className="text-xs text-muted-foreground"> · Paragraph {it.paragraph_index}</span>}
                      {it.explanation && <p className="text-muted-foreground">{it.explanation}</p>}
                    </li>
                  ))}
                  {(data.priority_improvement_areas ?? []).length === 0 && <li className="text-sm font-display text-muted-foreground">Not available.</li>}
                </ul>
              </div>

              {/* E. Questions */}
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-2">Possible teacher follow-up questions</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {(data.possible_teacher_questions ?? []).map((q, i) => (
                    <li key={i} className="text-sm font-display text-foreground">{q}</li>
                  ))}
                  {(data.possible_teacher_questions ?? []).length === 0 && <li className="text-sm font-display text-muted-foreground">Not available.</li>}
                </ul>
              </div>

              {/* F. Writing process */}
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-2">Writing process</h3>
                <p className="text-sm font-display text-muted-foreground">
                  Duration {data.writing_duration_seconds ? `${Math.round(data.writing_duration_seconds / 60)} min` : "not available"} ·
                  {" "}{data.final_word_count ?? "—"} words · {data.paragraph_count ?? "—"} paragraphs ·
                  {" "}{data.meaningful_revision_count ?? "—"} meaningful revisions
                </p>
                {onOpenPlayback && (
                  <Button size="sm" variant="outline" className="font-display mt-2" onClick={onOpenPlayback}>
                    Open writing playback
                  </Button>
                )}
                <p className="text-xs font-display text-muted-foreground mt-2">
                  Writing-process data reflects recorded activity in this workspace. It does not independently verify authorship or use of external tools.
                </p>
              </div>

              {/* G. AI interaction */}
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-2">AI coach interaction</h3>
                {data.ai_questions_shown === null ? (
                  <p className="text-sm font-display text-muted-foreground">No coach interaction data recorded for this essay.</p>
                ) : (
                  <p className="text-sm font-display text-muted-foreground">
                    Questions shown {data.ai_questions_shown} · answered {data.ai_questions_answered ?? 0} · skipped {data.ai_questions_skipped ?? 0} ·
                    {" "}marked “not now” {data.ai_questions_not_now ?? 0} · prompts paused: {data.ai_coach_paused ? "yes" : "no"}
                    {(data.ai_prompt_topics ?? []).length > 0 && <> · topics: {(data.ai_prompt_topics ?? []).join(", ")}</>}
                  </p>
                )}
              </div>

              {/* H + I */}
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-2">AI-support interpretation</h3>
                <Badge variant="outline" className="font-display">{data.ai_support_label ?? "Insufficient data"}</Badge>
                {data.ai_support_interpretation && (
                  <p className="text-sm font-display text-muted-foreground mt-2">{data.ai_support_interpretation}</p>
                )}
                <p className="text-xs font-display text-muted-foreground mt-2">
                  Suggested revision type (provisional): {data.ai_suggested_revision_type ?? "uncertain"} · confidence {data.ai_revision_confidence ?? "Low"}.
                  This is not final coding and does not establish causation.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => generate(true)} disabled={busy} className="font-display">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />{busy ? "Regenerating…" : "Regenerate brief"}
                </Button>
                <span className="text-xs font-display text-muted-foreground">Grading stays with you — this brief never changes the saved grade.</span>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default TeacherAssessmentBrief;
