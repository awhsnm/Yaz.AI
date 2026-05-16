import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shield, LogOut, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import AITutorSidebar from "@/components/AITutorSidebar";
import ExitModal from "@/components/ExitModal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SESSION_DURATION = 45 * 60;

interface Msg { id: string; role: "user" | "assistant"; content: string; }

const StudentWorkspace = () => {
  const { id: essayId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [essay, setEssay] = useState("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [chatHistory, setChatHistory] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExit, setShowExit] = useState(false);
  const [remaining, setRemaining] = useState(SESSION_DURATION);
  const lastSaved = useRef("");

  // Load essay + messages
  useEffect(() => {
    if (!essayId || !user) return;
    (async () => {
      const { data: e, error } = await supabase
        .from("essays")
        .select("*")
        .eq("id", essayId)
        .maybeSingle();
      if (error || !e) {
        navigate("/student-dashboard");
        return;
      }
      setEssay(e.content);
      setTopic(e.topic);
      setSubject(e.subject);
      setIsSubmitted(!!e.is_submitted);
      lastSaved.current = e.content;
      const { data: m } = await supabase
        .from("messages")
        .select("id, content, sender, created_at")
        .eq("essay_id", essayId)
        .order("created_at");
      setChatHistory(
        (m ?? []).map((x) => ({
          id: x.id,
          role: x.sender === "ai" ? "assistant" : "user",
          content: x.content,
        }))
      );
      setLoading(false);
    })();
  }, [essayId, user, navigate]);

  // Auto-save essay every 5s if changed
  useEffect(() => {
    if (!essayId || loading || isSubmitted) return;
    const i = setInterval(async () => {
      if (essay === lastSaved.current) return;
      const snapshot = essay;
      const { error } = await supabase.from("essays").update({ content: snapshot }).eq("id", essayId);
      if (!error) lastSaved.current = snapshot;
    }, 5000);
    return () => clearInterval(i);
  }, [essay, essayId, loading, isSubmitted]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Your essay is auto-saved. Are you sure you want to leave?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    if (loading || isSubmitted) return;
    const t = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(t);
  }, [loading, isSubmitted]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (loading || isSubmitted || remaining > 0) return;
    (async () => {
      await supabase.from("essays").update({ content: essay, is_submitted: true }).eq("id", essayId);
      setIsSubmitted(true);
      toast({ title: "Time's up", description: "Your essay was auto-submitted." });
    })();
  }, [remaining, loading, isSubmitted, essay, essayId, toast]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    toast({ title: "Paste disabled", description: "Write in your own words.", variant: "destructive" });
  }, [toast]);

  const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const isTimeUp = remaining === 0;
  const isLowTime = remaining <= 300 && remaining > 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">Loading session...</div>;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-11 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-xs font-display font-medium text-success">Focus Mode</span>
          </div>
          <span className="text-xs text-muted-foreground font-display">|</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-display">
            <BookOpen className="w-3 h-3" />
            <span className="truncate max-w-[260px]">{topic}</span>
          </div>
          {isSubmitted && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wide">
              Status: Submitted
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!isSubmitted && (
            <div className={`flex items-center gap-1.5 text-xs font-display font-medium ${isTimeUp ? "text-destructive" : isLowTime ? "text-warning" : "text-muted-foreground"}`}>
              <Clock className="w-3.5 h-3.5" />
              {isTimeUp ? "Time's up" : formatTime(remaining)}
            </div>
          )}
          <span className="text-xs text-muted-foreground font-display">{wordCount} words</span>
          {isSubmitted ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/student-dashboard")} className="font-display text-xs h-7">
              <LogOut className="w-3 h-3 mr-1" />Back to dashboard
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowExit(true)} className="font-display text-xs h-7">
              <LogOut className="w-3 h-3 mr-1" />Submit & Exit
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-[7] flex justify-center overflow-y-auto p-8">
          <div className="w-full max-w-[800px]">
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              onPaste={handlePaste}
              readOnly={isSubmitted}
              placeholder={`Begin writing your essay on "${topic}"...`}
              className={`w-full h-full min-h-[calc(100vh-8rem)] resize-none bg-transparent focus-editor outline-none placeholder:text-muted-foreground/50 ${isSubmitted ? "cursor-not-allowed opacity-90" : ""}`}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-[3] min-w-[300px] max-w-[400px]">
          <AITutorSidebar
            essayId={essayId!}
            topic={topic}
            subject={subject}
            currentDraft={essay}
            restoredChatHistory={chatHistory}
            onChatHistoryChange={setChatHistory}
          />
        </div>
      </div>

      <ExitModal open={showExit} onClose={() => setShowExit(false)} essayContent={essay} essayId={essayId} />
    </div>
  );
};

export default StudentWorkspace;