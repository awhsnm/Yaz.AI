import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, MessageSquare, Sparkles, Save, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import AnnotatedText, { type Annotation } from "@/components/AnnotatedText";

interface Essay {
  id: string;
  topic: string;
  subject: string;
  content: string;
  is_submitted: boolean;
  student_id: string;
  ai_probability: number | null;
  ai_checked_at: string | null;
}
interface Msg { id: string; content: string; sender: "user" | "ai"; created_at: string; }

const COLORS = [
  { name: "Yellow", code: "#fde68a" },
  { name: "Green", code: "#bbf7d0" },
  { name: "Pink", code: "#fbcfe8" },
  { name: "Blue", code: "#bfdbfe" },
];

const TeacherReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [essay, setEssay] = useState<Essay | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [evalSaving, setEvalSaving] = useState(false);

  const [aiBusy, setAiBusy] = useState(false);

  const [selection, setSelection] = useState<{ start: number; end: number; rect: DOMRect } | null>(null);
  const [popOpen, setPopOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0].code);

  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: e } = await supabase.from("essays").select("*").eq("id", id).maybeSingle();
      if (e) {
        setEssay(e as Essay);
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", e.student_id).maybeSingle();
        setStudentName(p?.full_name ?? null);
      }
      const [{ data: m }, { data: a }, { data: ev }] = await Promise.all([
        supabase.from("messages").select("id, content, sender, created_at").eq("essay_id", id).order("created_at"),
        supabase.from("annotations").select("id, start_index, end_index, color_code, comment_text").eq("essay_id", id).order("start_index"),
        supabase.from("evaluations").select("grade, feedback").eq("essay_id", id).maybeSingle(),
      ]);
      setMessages((m ?? []) as Msg[]);
      setAnnotations((a ?? []) as Annotation[]);
      if (ev) { setGrade(ev.grade ?? ""); setFeedback(ev.feedback ?? ""); }
    })();
  }, [id]);

  // Compute character offsets within the essay content container
  const getOffsetsFromSelection = useCallback((): { start: number; end: number } | null => {
    const root = contentRef.current;
    if (!root) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return null;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let start = -1, end = -1;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const len = (node.nodeValue ?? "").length;
      if (node === range.startContainer) start = offset + range.startOffset;
      if (node === range.endContainer) { end = offset + range.endOffset; break; }
      offset += len;
    }
    if (start < 0 || end < 0 || end <= start) return null;
    return { start, end };
  }, []);

  const onMouseUp = useCallback(() => {
    const off = getOffsetsFromSelection();
    if (!off) { setSelection(null); return; }
    const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
    setSelection({ ...off, rect });
  }, [getOffsetsFromSelection]);

  const addAnnotation = async () => {
    if (!selection || !id || !user) return;
    const { data, error } = await supabase
      .from("annotations")
      .insert({
        essay_id: id,
        teacher_id: user.id,
        start_index: selection.start,
        end_index: selection.end,
        color_code: newColor,
        comment_text: newComment.trim(),
      })
      .select("id, start_index, end_index, color_code, comment_text")
      .single();
    if (error) {
      toast({ title: "Could not add comment", description: error.message, variant: "destructive" });
      return;
    }
    setAnnotations((prev) => [...prev, data as Annotation].sort((a, b) => a.start_index - b.start_index));
    setNewComment("");
    setSelection(null);
    setPopOpen(false);
    window.getSelection()?.removeAllRanges();
  };

  const deleteAnnotation = async (annId: string) => {
    await supabase.from("annotations").delete().eq("id", annId);
    setAnnotations((prev) => prev.filter((a) => a.id !== annId));
  };

  const scrollToMark = (annId: string) => {
    setActiveId(annId);
    const el = contentRef.current?.querySelector(`mark[data-annotation-id="${annId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToSidebar = (annId: string) => {
    setActiveId(annId);
    const el = sidebarRef.current?.querySelector(`[data-comment-id="${annId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const runAiCheck = async () => {
    if (!id) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-ai", { body: { essay_id: id } });
      if (error) throw error;
      setEssay((e) => e ? { ...e, ai_probability: data.probability, ai_checked_at: data.ai_checked_at } : e);
      toast({ title: "AI check complete", description: `${data.probability}% likely AI-generated` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: "AI check failed", description: msg, variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  const saveEvaluation = async () => {
    if (!id || !user) return;
    setEvalSaving(true);
    const { error } = await supabase.from("evaluations").upsert(
      { essay_id: id, teacher_id: user.id, grade, feedback },
      { onConflict: "essay_id" }
    );
    setEvalSaving(false);
    if (error) toast({ title: "Could not save", description: error.message, variant: "destructive" });
    else toast({ title: "Evaluation saved", description: "Student will see this on their dashboard." });
  };

  const aiTone = useMemo(() => {
    const p = essay?.ai_probability ?? null;
    if (p === null) return "text-muted-foreground";
    if (p >= 70) return "text-destructive";
    if (p >= 40) return "text-warning";
    return "text-success";
  }, [essay?.ai_probability]);

  if (!essay) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">Loading...</div>;

  const wc = essay.content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher-dashboard")}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1">
            <h1 className="font-display font-bold text-foreground">{studentName ?? "Student"}</h1>
            <p className="text-xs text-muted-foreground font-display">{essay.topic} • {wc} words</p>
          </div>
          <Badge variant="outline" className="font-display">{essay.subject}</Badge>
          {essay.is_submitted && <Badge className="font-display">Submitted</Badge>}
          <Button size="sm" onClick={runAiCheck} disabled={aiBusy} className="font-display">
            <Sparkles className="w-3.5 h-3.5 mr-1" />{aiBusy ? "Analyzing..." : "Check for AI"}
          </Button>
        </div>
        {essay.ai_probability !== null && (
          <div className="max-w-7xl mx-auto px-6 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-display font-semibold ${aiTone}`}>
                {essay.ai_probability}% likely AI-generated
              </span>
              {essay.ai_checked_at && (
                <span className="text-[10px] text-muted-foreground font-display">
                  checked {new Date(essay.ai_checked_at).toLocaleString()}
                </span>
              )}
            </div>
            <Progress value={essay.ai_probability} className="h-2" />
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid lg:grid-cols-3 gap-6">
        {/* Essay + annotations */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />Final Essay
              <span className="text-xs text-muted-foreground font-normal ml-2">Select text to add a comment</span>
            </h2>
            <div
              className="bg-card border border-border rounded-lg p-5 min-h-[300px] relative"
              onMouseUp={onMouseUp}
            >
              <AnnotatedText
                content={essay.content}
                annotations={annotations}
                activeId={activeId}
                onMarkClick={scrollToSidebar}
                containerRef={contentRef}
              />
              {selection && (
                <Popover open={popOpen} onOpenChange={(o) => { setPopOpen(o); if (!o) setSelection(null); }}>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      className="fixed z-50 font-display shadow-lg"
                      style={{
                        top: `${selection.rect.bottom + window.scrollY + 6}px`,
                        left: `${selection.rect.left + window.scrollX}px`,
                      }}
                      onClick={() => setPopOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />Add Comment
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <div className="space-y-3">
                      <p className="text-xs font-display text-muted-foreground">
                        "{essay.content.slice(selection.start, selection.end).slice(0, 80)}{selection.end - selection.start > 80 ? "…" : ""}"
                      </p>
                      <div className="flex gap-1.5">
                        {COLORS.map((c) => (
                          <button
                            key={c.code}
                            onClick={() => setNewColor(c.code)}
                            style={{ backgroundColor: c.code }}
                            className={`w-6 h-6 rounded-full border-2 ${newColor === c.code ? "border-foreground" : "border-transparent"}`}
                            aria-label={c.name}
                          />
                        ))}
                      </div>
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Your comment..."
                        className="font-display text-sm min-h-[80px]"
                        autoFocus
                      />
                      <Button size="sm" onClick={addAnnotation} className="w-full font-display">Save Comment</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Final Feedback */}
          <div>
            <h2 className="font-display font-semibold text-foreground mb-3">Final Feedback</h2>
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div>
                <label className="text-xs font-display font-medium text-muted-foreground">Grade / Score</label>
                <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. A or 85/100" className="font-display mt-1" />
              </div>
              <div>
                <label className="text-xs font-display font-medium text-muted-foreground">Feedback</label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Overall feedback for the student..."
                  className="font-display min-h-[140px] mt-1"
                />
              </div>
              <Button onClick={saveEvaluation} disabled={evalSaving} className="font-display">
                <Save className="w-4 h-4 mr-1" />{evalSaving ? "Saving..." : "Save Evaluation"}
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar: comments + chat */}
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-foreground mb-3">Comments ({annotations.length})</h2>
            <div ref={sidebarRef} className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {annotations.length === 0 && <p className="text-sm text-muted-foreground font-display">Select text in the essay to add a comment.</p>}
              {annotations.map((a) => (
                <div
                  key={a.id}
                  data-comment-id={a.id}
                  onClick={() => scrollToMark(a.id)}
                  className={`bg-card border rounded-lg p-3 cursor-pointer transition-all ${activeId === a.id ? "border-primary shadow-sm" : "border-border hover:border-primary/50"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: a.color_code }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-display italic truncate">
                        "{essay.content.slice(a.start_index, a.end_index).slice(0, 60)}"
                      </p>
                      {a.comment_text && <p className="text-sm font-display mt-1">{a.comment_text}</p>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAnnotation(a.id); }}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />AI Chat Log ({messages.length})
            </h2>
            <div className="bg-card border border-border rounded-lg p-4 space-y-3 max-h-[40vh] overflow-y-auto">
              {messages.length === 0 && <p className="text-sm text-muted-foreground font-display">No AI conversation recorded.</p>}
              {messages.map((m) => (
                <div key={m.id} className={m.sender === "ai" ? "" : "flex justify-end"}>
                  <div className={`rounded-lg px-3 py-2 text-sm font-display max-w-[90%] ${m.sender === "ai" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                    {m.sender === "ai" ? (
                      <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherReview;