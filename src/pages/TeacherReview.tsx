import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface Essay {
  id: string;
  topic: string;
  subject: string;
  content: string;
  is_submitted: boolean;
  student_id: string;
}
interface Msg { id: string; content: string; sender: "user" | "ai"; created_at: string; }

const TeacherReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [essay, setEssay] = useState<Essay | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: e } = await supabase.from("essays").select("*").eq("id", id).maybeSingle();
      if (e) {
        setEssay(e as Essay);
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", e.student_id).maybeSingle();
        setStudentName(p?.full_name ?? null);
      }
      const { data: m } = await supabase
        .from("messages")
        .select("id, content, sender, created_at")
        .eq("essay_id", id)
        .order("created_at");
      setMessages((m ?? []) as Msg[]);
    })();
  }, [id]);

  if (!essay) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">Loading...</div>;

  const wc = essay.content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher-dashboard")}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1">
            <h1 className="font-display font-bold text-foreground">{studentName ?? "Student"}</h1>
            <p className="text-xs text-muted-foreground font-display">{essay.topic} • {wc} words</p>
          </div>
          <Badge variant="outline" className="font-display">{essay.subject}</Badge>
          {essay.is_submitted && <Badge className="font-display">Submitted</Badge>}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />Final Essay</h2>
          <div className="bg-card border border-border rounded-lg p-5 whitespace-pre-wrap font-display text-sm leading-relaxed min-h-[300px]">
            {essay.content || <span className="text-muted-foreground italic">Empty</span>}
          </div>
        </div>
        <div>
          <h2 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" />AI Chat Log ({messages.length})</h2>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3 max-h-[70vh] overflow-y-auto">
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
  );
};

export default TeacherReview;