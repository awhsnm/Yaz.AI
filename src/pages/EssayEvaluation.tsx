import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Wrench, RefreshCw, AlertTriangle, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EVAL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-essay`;

interface Criterion { key: string; label: string; score: number; max: number; explanation: string }
interface WeakExcerpt { excerpt: string; reason: string }
export interface Evaluation {
  total: number;
  band: string;
  criteria: Criterion[];
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  weak_excerpts: WeakExcerpt[];
}
interface Essay { id: string; topic: string; subject: string; content: string; ai_evaluation: Evaluation | null; updated_at?: string | null; is_submitted?: boolean }

const toneFor = (ratio: number) =>
  ratio >= 0.8 ? "text-success" : ratio >= 0.6 ? "text-primary" : ratio >= 0.4 ? "text-warning" : "text-destructive";

const EssayEvaluation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [essay, setEssay] = useState<Essay | null>(null);
  const [content, setContent] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [previous, setPrevious] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("essays")
        .select("id, topic, subject, content, ai_evaluation, updated_at, is_submitted")
        .eq("id", id)
        .maybeSingle();
      if (!data) { navigate("/student-dashboard", { replace: true }); return; }
      const e = data as unknown as Essay;
      setEssay(e);
      setContent(e.content ?? "");
      if (e.ai_evaluation && typeof e.ai_evaluation === "object") setEvaluation(e.ai_evaluation);
      setLoading(false);
    })();
  }, [id, navigate]);

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const submittedAt = essay?.updated_at
    ? new Date(essay.updated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";

  const runEvaluation = async (text: string) => {
    if (!essay) return;
    setRunning(true);
    try {
      const resp = await fetch(EVAL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic: essay.topic, subject: essay.subject, content: text }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Error ${resp.status}`);
      setPrevious(evaluation?.total ?? null);
      setEvaluation(data as Evaluation);
      await supabase
        .from("essays")
        .update({ ai_evaluation: data, ai_evaluation_at: new Date().toISOString() })
        .eq("id", essay.id);
    } catch (err) {
      toast({
        title: "Could not evaluate the essay",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  // No automatic evaluation: the AI call runs only when the student requests it.



  const saveAndReevaluate = async () => {
    if (!essay) return;
    setSaving(true);
    await supabase
      .from("essays")
      .update({ content, revision_count: (essay as unknown as { revision_count?: number }).revision_count ?? 0 })
      .eq("id", essay.id);
    setSaving(false);
    await runEvaluation(content);
  };

  const selectExcerpt = (excerpt: string) => {
    const idx = content.indexOf(excerpt);
    const el = editorRef.current;
    if (idx < 0 || !el) return;
    el.focus();
    el.setSelectionRange(idx, idx + excerpt.length);
    const ratio = idx / Math.max(content.length, 1);
    el.scrollTop = ratio * el.scrollHeight - el.clientHeight / 2;
  };

  // Read-only view of the essay with weak sections highlighted.
  const highlighted = useMemo(() => {
    const weak = (evaluation?.weak_excerpts ?? []).filter((w) => content.includes(w.excerpt));
    const ranges = weak
      .map((w) => ({ start: content.indexOf(w.excerpt), end: content.indexOf(w.excerpt) + w.excerpt.length, reason: w.reason }))
      .sort((a, b) => a.start - b.start);
    const parts: { text: string; reason?: string }[] = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.start < cursor) continue;
      if (r.start > cursor) parts.push({ text: content.slice(cursor, r.start) });
      parts.push({ text: content.slice(r.start, r.end), reason: r.reason });
      cursor = r.end;
    }
    if (cursor < content.length) parts.push({ text: content.slice(cursor) });
    return parts;
  }, [content, evaluation]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">Loading evaluation…</div>;
  }

  const delta = previous !== null && evaluation ? evaluation.total - previous : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student-dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-foreground truncate">Essay Evaluation &amp; Review Hub</h1>
            <p className="text-xs text-muted-foreground font-display truncate">{essay?.topic} • {wordCount} words</p>
          </div>
          <Badge variant="outline" className="font-display">{essay?.subject}</Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {!evaluation ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center space-y-5">
            {running ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                <p className="font-display text-sm text-muted-foreground">
                  Analyzing essay structure, argumentation, and grammar…
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
                <div className="space-y-1">
                  <h2 className="font-display font-semibold text-lg text-foreground">Essay submitted</h2>
                  <p className="font-display text-sm text-muted-foreground">
                    Your draft is finalized and locked. AI feedback is optional and runs only when you ask for it.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-6 text-sm font-display">
                  <div>
                    <p className="text-muted-foreground text-xs">Submitted</p>
                    <p className="text-foreground font-medium">{submittedAt}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Word count</p>
                    <p className="text-foreground font-medium">{wordCount} words</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <Button className="font-display" disabled={wordCount < 20} onClick={() => runEvaluation(content)}>
                    <Sparkles className="w-4 h-4 mr-2" />Request AI Diagnostic &amp; Feedback
                  </Button>
                  <Button variant="outline" className="font-display" onClick={() => navigate("/student-dashboard")}>
                    Return to Dashboard
                  </Button>
                </div>
                {wordCount < 20 && (
                  <p className="font-display text-xs text-muted-foreground">
                    At least 20 words are needed for an AI diagnostic.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Score badge */}
            <div className="bg-card border border-border rounded-lg p-6 flex flex-wrap items-center gap-6">
              <div>
                <p className={`font-display font-bold text-4xl ${toneFor(evaluation.total / 100)}`}>
                  {evaluation.total} <span className="text-xl text-muted-foreground">/ 100</span>
                </p>
                <p className="font-display text-sm text-muted-foreground mt-1">{evaluation.band}</p>
              </div>
              {delta !== null && delta !== 0 && (
                <Badge variant="outline" className={`font-display ${delta > 0 ? "text-success" : "text-destructive"}`}>
                  {delta > 0 ? `+${delta}` : delta} since last version
                </Badge>
              )}
              <div className="flex-1" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="font-display" onClick={() => setRevising((v) => !v)}>
                  <Wrench className="w-4 h-4 mr-2" />{revising ? "Hide revision editor" : "Polish & Revise Draft"}
                </Button>
                <Button className="font-display" onClick={() => navigate("/student-dashboard")}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />Complete &amp; Return to Dashboard
                </Button>
              </div>
            </div>

            {/* Rubric bars */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
              <h2 className="font-display font-semibold text-foreground">Rubric breakdown</h2>
              {evaluation.criteria.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-sm font-medium text-foreground">{c.label}</p>
                    <p className={`font-display text-sm font-semibold ${toneFor(c.score / c.max)}`}>{c.score} / {c.max}</p>
                  </div>
                  <Progress value={(c.score / c.max) * 100} className="h-2" />
                  <p className="font-display text-xs text-muted-foreground">{c.explanation}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {([
                ["Key Strengths", evaluation.strengths, "text-success", CheckCircle2],
                ["Critical Areas for Improvement", evaluation.improvements, "text-warning", AlertTriangle],
                ["Actionable Suggestions", evaluation.suggestions, "text-primary", Lightbulb],
              ] as const).map(([title, items, tone, Icon]) => (
                <div key={title} className="bg-card border border-border rounded-lg p-4">
                  <h3 className={`font-display font-semibold text-sm mb-2 flex items-center gap-1.5 ${tone}`}>
                    <Icon className="w-4 h-4" />{title}
                  </h3>
                  <ul className="space-y-1.5 list-disc pl-4">
                    {(items ?? []).map((s, i) => (
                      <li key={i} className="text-sm font-display text-foreground">{s}</li>
                    ))}
                    {(items ?? []).length === 0 && (
                      <li className="text-sm font-display text-muted-foreground list-none pl-0">Nothing noted.</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>

            {/* Revision mode */}
            {revising ? (
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display font-semibold text-foreground">Revision mode — no timer</h2>
                    <span className="text-xs font-display text-muted-foreground">{wordCount} words</span>
                  </div>
                  <textarea
                    ref={editorRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full min-h-[60vh] resize-y bg-card border border-border rounded-lg p-5 font-display text-base leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button className="font-display" disabled={saving || running || wordCount < 20} onClick={saveAndReevaluate}>
                      {saving || running
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Re-evaluating…</>
                        : <><RefreshCw className="w-4 h-4 mr-2" />Re-evaluate Essay</>}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="font-display font-semibold text-foreground">Weak sections ({evaluation.weak_excerpts.length})</h2>
                  {evaluation.weak_excerpts.length === 0 && (
                    <p className="text-sm font-display text-muted-foreground">No specific weak passages were flagged.</p>
                  )}
                  {evaluation.weak_excerpts.map((w, i) => (
                    <button
                      key={i}
                      onClick={() => selectExcerpt(w.excerpt)}
                      className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-primary transition-colors"
                    >
                      <p className="text-xs font-display italic text-muted-foreground line-clamp-3">"{w.excerpt}"</p>
                      <p className="text-sm font-display text-foreground mt-1">{w.reason}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="font-display font-semibold text-foreground">Your essay (weak sections highlighted)</h2>
                <div className="bg-card border border-border rounded-lg p-5 font-display text-base leading-relaxed whitespace-pre-wrap">
                  {highlighted.map((p, i) =>
                    p.reason ? (
                      <mark key={i} title={p.reason} className="bg-warning/25 text-foreground rounded px-0.5">{p.text}</mark>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EssayEvaluation;
