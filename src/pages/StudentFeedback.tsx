import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Award, BookOpen, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import AnnotatedText, { type Annotation } from "@/components/AnnotatedText";
import { useToast } from "@/hooks/use-toast";

interface Essay { id: string; topic: string; subject: string; content: string; mode: string | null; classroom_id: string | null; ai_feedback: string | null; }
interface Evaluation { grade: string; feedback: string; updated_at: string; }
interface AiFeedback { strengths: string[]; weaknesses: string[]; suggestions: string[] }


const StudentFeedback = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [essay, setEssay] = useState<Essay | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: e }, { data: a }, { data: ev }] = await Promise.all([
        supabase.from("essays").select("id, topic, subject, content, mode, classroom_id, ai_feedback").eq("id", id).maybeSingle(),
        supabase.from("annotations").select("id, start_index, end_index, color_code, comment_text").eq("essay_id", id).order("start_index"),
        supabase.from("evaluations").select("grade, feedback, updated_at").eq("essay_id", id).maybeSingle(),
      ]);
      if (e) {
        setEssay(e as unknown as Essay);
        const stored = (e as unknown as Essay).ai_feedback;
        if (stored) { try { setAiFeedback(JSON.parse(stored)); } catch { /* ignore */ } }
      }
      setAnnotations((a ?? []) as Annotation[]);
      setEvaluation((ev as Evaluation) ?? null);
    })();
  }, [id]);

  if (!essay) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">Loading...</div>;

  const wc = essay.content.trim().split(/\s+/).filter(Boolean).length;
  const isClassroom = (essay.mode ?? (essay.classroom_id ? "classroom" : "solo")) === "classroom";

  const generateFeedback = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("essay-feedback", {
        body: { topic: essay.topic, subject: essay.subject, content: essay.content },
      });
      if (error) throw new Error((data as { error?: string } | null)?.error || error.message);
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
      setAiFeedback(data);
      await supabase
        .from("essays")
        .update({ ai_feedback: JSON.stringify(data), ai_feedback_at: new Date().toISOString() })
        .eq("id", essay.id);
    } catch (err) {
      toast({ title: "Could not generate feedback", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const focusComment = (id: string) => {
    setActiveId(id);
    const el = commentRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student-dashboard")}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1">
            <h1 className="font-display font-bold text-foreground">{isClassroom ? "Evaluated Essay" : "Your Submitted Essay"}</h1>
            <p className="text-xs text-muted-foreground font-display">{essay.topic} • {wc} words</p>
          </div>
          <Badge variant="outline" className="font-display">{essay.subject}</Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />{isClassroom ? "Your essay (with teacher's feedback)" : "Your essay"}</h2>
          <div className="bg-card border border-border rounded-lg p-5">
            {essay.content ? (
              <AnnotatedText
                content={essay.content}
                annotations={isClassroom ? annotations : []}
                activeId={activeId}
                onMarkClick={focusComment}
              />
            ) : (
              <p className="text-sm font-display text-muted-foreground italic">This essay has no content.</p>
            )}
          </div>
        </div>

        {isClassroom ? (
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-primary" />Grade & Feedback</h2>
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              {evaluation ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground font-display">Grade</p>
                    <p className="font-display font-bold text-2xl text-foreground">{evaluation.grade || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-display">Feedback</p>
                    <p className="font-display text-sm whitespace-pre-wrap mt-1">{evaluation.feedback || "No written feedback."}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm font-display text-muted-foreground">Your teacher hasn't published feedback yet.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="font-display font-semibold text-foreground mb-3">Comments ({annotations.length})</h2>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {annotations.length === 0 && <p className="text-sm text-muted-foreground font-display">No comments.</p>}
              {annotations.map((a) => (
                <div
                  key={a.id}
                  ref={(el) => { commentRefs.current[a.id] = el; }}
                  onClick={() => setActiveId(a.id)}
                  className={`bg-card border rounded-lg p-3 cursor-pointer transition-colors ${activeId === a.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: a.color_code }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-display italic">
                        "{essay.content.slice(a.start_index, a.end_index).slice(0, 80)}"
                      </p>
                      {a.comment_text && <p className="text-sm font-display mt-1">{a.comment_text}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        ) : (
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-success" />AI Feedback
            </h2>
            {!aiFeedback ? (
              <div className="bg-card border border-border rounded-lg p-5 space-y-3">
                <p className="text-sm font-display text-muted-foreground">
                  Get an instant, structured review of this essay.
                </p>
                <Button onClick={generateFeedback} disabled={generating || wc < 20} className="w-full font-display">
                  {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <>✨ Generate AI Feedback</>}
                </Button>
                {wc < 20 && <p className="text-xs font-display text-muted-foreground">Write at least 20 words to get feedback.</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {([
                  ["Strongest Aspects", aiFeedback.strengths, "text-success"],
                  ["Weakest Aspects", aiFeedback.weaknesses, "text-warning"],
                  ["Actionable Suggestions", aiFeedback.suggestions, "text-primary"],
                ] as const).map(([title, items, tone]) => (
                  <div key={title} className="bg-card border border-border rounded-lg p-4">
                    <h3 className={`font-display font-semibold text-sm mb-2 ${tone}`}>{title}</h3>
                    <ul className="space-y-1.5 list-disc pl-4">
                      {(items ?? []).map((s, i) => (
                        <li key={i} className="text-sm font-display text-foreground">{s}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Button variant="outline" onClick={generateFeedback} disabled={generating} className="w-full font-display">
                  {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : "Regenerate feedback"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentFeedback;