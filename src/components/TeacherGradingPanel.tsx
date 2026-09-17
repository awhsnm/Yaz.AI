import { useCallback, useEffect, useState } from "react";
import { Award, Bot, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import WritingProcessSummary from "@/components/WritingProcessSummary";

interface RubricRow {
  id: string;
  criterion: string;
  score: number | null;
  max_score: number;
  comment: string | null;
  position: number;
}

interface SubmissionRow {
  id: string;
  version: number;
  submitted_at: string;
  word_count: number;
  ai_questions_shown: number;
  ai_student_responses: number;
}

const DEFAULT_CRITERIA = ["Ideas and reasoning", "Organization", "Language and clarity", "Conventions"];

const fmt = (iso: string) => new Date(iso).toLocaleString();

/**
 * Additive teacher panel: rubric grading, return-for-revision and a neutral
 * AI support summary. It never edits the student's text.
 */
const TeacherGradingPanel = ({ essayId }: { essayId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<RubricRow[]>([]);
  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [visibility, setVisibility] = useState<string>("");
  const [returnNote, setReturnNote] = useState("");
  const [overall, setOverall] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: r }, { data: s }, { data: e }, { data: ev }] = await Promise.all([
      supabase.from("essay_rubric_scores").select("id, criterion, score, max_score, comment, position").eq("essay_id", essayId).order("position"),
      supabase.from("essay_submissions").select("id, version, submitted_at, word_count, ai_questions_shown, ai_student_responses").eq("essay_id", essayId).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("essays").select("visibility").eq("id", essayId).maybeSingle(),
      supabase.from("evaluations").select("grade").eq("essay_id", essayId).maybeSingle(),
    ]);
    setRows((r ?? []) as RubricRow[]);
    setSubmission((s ?? null) as SubmissionRow | null);
    setVisibility(((e as { visibility?: string } | null)?.visibility) ?? "");
    if (ev?.grade) setOverall(ev.grade);
  }, [essayId]);

  useEffect(() => { load(); }, [load]);

  const seedRubric = async () => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.from("essay_rubric_scores").insert(
      DEFAULT_CRITERIA.map((criterion, i) => ({ essay_id: essayId, teacher_id: user.id, criterion, max_score: 10, position: i }))
    ).select("id, criterion, score, max_score, comment, position");
    setBusy(false);
    if (error) return toast({ title: "Could not create rubric", description: error.message, variant: "destructive" });
    setRows((data ?? []) as RubricRow[]);
  };

  const addRow = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("essay_rubric_scores")
      .insert({ essay_id: essayId, teacher_id: user.id, criterion: "New criterion", max_score: 10, position: rows.length })
      .select("id, criterion, score, max_score, comment, position").single();
    if (error) return toast({ title: "Could not add criterion", description: error.message, variant: "destructive" });
    setRows((p) => [...p, data as RubricRow]);
  };

  const patch = (id: string, next: Partial<RubricRow>) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...next } : r)));

  const persist = async (row: RubricRow) => {
    await supabase.from("essay_rubric_scores")
      .update({ criterion: row.criterion, score: row.score, max_score: row.max_score, comment: row.comment })
      .eq("id", row.id);
  };

  const removeRow = async (id: string) => {
    setRows((p) => p.filter((r) => r.id !== id));
    await supabase.from("essay_rubric_scores").delete().eq("id", id);
  };

  const total = rows.reduce((a, r) => a + (r.score ?? 0), 0);
  const maxTotal = rows.reduce((a, r) => a + (r.max_score ?? 0), 0);

  const saveRubric = async () => {
    setBusy(true);
    await Promise.all(rows.map(persist));
    setBusy(false);
    toast({ title: "Rubric saved" });
  };

  const returnForRevision = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("return_essay_for_revision", { _essay_id: essayId, _comment: returnNote || null });
    setBusy(false);
    if (error) return toast({ title: "Could not return essay", description: error.message, variant: "destructive" });
    setVisibility("returned");
    toast({ title: "Returned for revision", description: "The student can see your comments and keep working." });
  };

  const markGraded = async () => {
    setBusy(true);
    await Promise.all(rows.map(persist));
    const { error } = await supabase.rpc("mark_essay_graded", {
      _essay_id: essayId,
      _grade: overall || (maxTotal ? `${total}/${maxTotal}` : ""),
      _feedback: returnNote || null,
    });
    setBusy(false);
    if (error) return toast({ title: "Could not save grade", description: error.message, variant: "destructive" });
    setVisibility("graded");
    toast({ title: "Marked as graded" });
  };

  return (
    <div className="space-y-4">
      {/* Submission + AI support summary */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-display font-semibold text-foreground mb-2 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />AI support summary
        </h2>
        {submission ? (
          <>
            <p className="text-sm font-display text-muted-foreground">
              AI support: {submission.ai_questions_shown} Socratic questions viewed; {submission.ai_student_responses} student responses completed.
            </p>
            <p className="text-sm font-display text-muted-foreground">AI-generated essay text: none.</p>
            <p className="text-xs font-display text-muted-foreground mt-2">
              Submitted version {submission.version} · {fmt(submission.submitted_at)} · {submission.word_count} words
            </p>
          </>
        ) : (
          <p className="text-sm font-display text-muted-foreground">
            This draft has not been submitted for grading yet.
          </p>
        )}
      </div>

      {/* Process facts (descriptive only) */}
      <WritingProcessSummary essayId={essayId} />

      {/* Rubric */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-foreground">Rubric</h2>
          {rows.length > 0 && (
            <span className="text-sm font-display text-muted-foreground">{total} / {maxTotal}</span>
          )}
        </div>

        {rows.length === 0 ? (
          <Button variant="outline" size="sm" className="font-display" disabled={busy} onClick={seedRubric}>
            <Plus className="w-3.5 h-3.5 mr-1" />Start a rubric
          </Button>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_4rem_4rem_auto] gap-2 items-center">
                <Input className="font-display h-8" value={r.criterion} onChange={(e) => patch(r.id, { criterion: e.target.value })} onBlur={() => persist(r)} />
                <Input className="font-display h-8" type="number" value={r.score ?? ""} placeholder="–"
                  onChange={(e) => patch(r.id, { score: e.target.value === "" ? null : Number(e.target.value) })} onBlur={() => persist(r)} />
                <Input className="font-display h-8" type="number" value={r.max_score}
                  onChange={(e) => patch(r.id, { max_score: Number(e.target.value) })} onBlur={() => persist(r)} />
                <button onClick={() => removeRow(r.id)} aria-label="Remove criterion" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="font-display" onClick={addRow}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add criterion
              </Button>
              <Button variant="outline" size="sm" className="font-display" disabled={busy} onClick={saveRubric}>
                <Save className="w-3.5 h-3.5 mr-1" />Save rubric
              </Button>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-display font-medium text-muted-foreground">Overall grade</label>
          <Input className="font-display mt-1" value={overall} onChange={(e) => setOverall(e.target.value)} placeholder={maxTotal ? `${total}/${maxTotal}` : "e.g. A or 85/100"} />
        </div>
        <div>
          <label className="text-xs font-display font-medium text-muted-foreground">Comment to the student</label>
          <Textarea className="font-display mt-1 min-h-[90px]" value={returnNote} onChange={(e) => setReturnNote(e.target.value)}
            placeholder="What to work on next..." />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="font-display" disabled={busy} onClick={returnForRevision}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Return for revision
          </Button>
          <Button size="sm" className="font-display" disabled={busy} onClick={markGraded}>
            <Award className="w-3.5 h-3.5 mr-1" />Mark as graded
          </Button>
          {visibility && (
            <span className="text-xs font-display text-muted-foreground self-center">Status: {visibility}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherGradingPanel;
