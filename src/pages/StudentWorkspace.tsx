import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shield, LogOut, Clock, BookOpen, Save, CheckCircle2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import AITutorSidebar from "@/components/AITutorSidebar";
import ExitModal from "@/components/ExitModal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/contexts/SettingsContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

const SIZE_CLASS = { small: "text-base", medium: "text-lg", large: "text-2xl" } as const;

const SESSION_DURATION = 45 * 60;
const MIN_WORDS = 20;

interface Msg { id: string; role: "user" | "assistant"; content: string; }

const StudentWorkspace = () => {
  const { id: essayId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { textSize } = useSettings();

  const [essay, setEssay] = useState("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [soloMode, setSoloMode] = useState(false);
  const [mode, setMode] = useState<"classroom" | "solo" | "brainstorm">("classroom");
  const [showLowWords, setShowLowWords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chatHistory, setChatHistory] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExit, setShowExit] = useState(false);
  const [remaining, setRemaining] = useState(SESSION_DURATION);
  const [showDiscard, setShowDiscard] = useState(false);
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
      // Submitted essays are read-only with annotations — route to the feedback viewer.
      if (e.is_submitted) {
        navigate(`/feedback/${essayId}`, { replace: true });
        return;
      }
      setEssay(e.content);
      setTopic(e.topic);
      setSubject(e.subject);
      setIsSubmitted(!!e.is_submitted);
      setSoloMode(e.classroom_id == null);
      setMode(((e as { mode?: string }).mode as "classroom" | "solo" | "brainstorm") ?? (e.classroom_id ? "classroom" : "solo"));
      const mins = (e as { duration_minutes?: number | null }).duration_minutes;
      if (mins && mins > 0) setRemaining(mins * 60);
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

  const timed = mode !== "brainstorm";

  useEffect(() => {
    if (loading || isSubmitted || !timed) return;
    const t = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(t);
  }, [loading, isSubmitted, timed]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (loading || isSubmitted || remaining > 0 || !timed) return;
    (async () => {
      await supabase.from("essays").update({ content: essay, is_submitted: true }).eq("id", essayId);
      setIsSubmitted(true);
      toast({ title: t("workspace.timeUp"), description: t("workspace.autoSubmitted") });
    })();
  }, [remaining, loading, isSubmitted, essay, essayId, toast, t, timed]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    toast({ title: t("workspace.pasteOff"), description: t("workspace.pasteHint"), variant: "destructive" });
  }, [toast, t]);

  const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const isTimeUp = remaining === 0;
  const isLowTime = remaining <= 300 && remaining > 0;

  const saveDraft = async (leave: boolean) => {
    if (!essayId) return;
    setSaving(true);
    await supabase.from("essays").update({ content: essay, is_submitted: false }).eq("id", essayId);
    lastSaved.current = essay;
    setSaving(false);
    setShowLowWords(false);
    if (leave) navigate("/student-dashboard");
    else toast({ title: t("workspace.draftSaved", "Draft saved") });
  };

  const finalSubmit = async () => {
    if (!essayId) return;
    setSaving(true);
    await supabase.from("essays").update({ content: essay, is_submitted: true }).eq("id", essayId);
    setSaving(false);
    navigate("/student-dashboard");
  };

  const requestSubmit = () => {
    if (wordCount < MIN_WORDS) { setShowLowWords(true); return; }
    if (mode === "brainstorm") { finalSubmit(); return; }
    setShowExit(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">{t("workspace.loadingSession")}</div>;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-11 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-xs font-display font-medium text-success">{t("workspace.focusMode")}</span>
          </div>
          <span className="text-xs text-muted-foreground font-display">|</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-display transition-colors">
                <BookOpen className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[260px]">{topic}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96">
              <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-1">
                {subject}
              </p>
              <p className="font-display text-sm text-foreground leading-relaxed">{topic}</p>
            </PopoverContent>
          </Popover>
          {isSubmitted && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wide">
              {t("workspace.statusSubmitted")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!isSubmitted && timed && (
            <div className={`flex items-center gap-1.5 text-xs font-display font-medium ${isTimeUp ? "text-destructive" : isLowTime ? "text-warning" : "text-muted-foreground"}`}>
              <Clock className="w-3.5 h-3.5" />
              {isTimeUp ? t("workspace.timeUp") : formatTime(remaining)}
            </div>
          )}
          <span className="text-xs text-muted-foreground font-display">{wordCount} {t("common.words")}</span>
          {isSubmitted ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/student-dashboard")} className="font-display text-xs h-7">
              <LogOut className="w-3 h-3 mr-1" />{t("workspace.back")}
            </Button>
          ) : mode === "brainstorm" ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={saving} onClick={() => saveDraft(true)} className="font-display text-xs h-7">
                <Save className="w-3 h-3 mr-1" />{t("workspace.saveDraft", "Save Draft & Pause")}
              </Button>
              <Button size="sm" disabled={saving} onClick={requestSubmit} className="font-display text-xs h-7">
                <CheckCircle2 className="w-3 h-3 mr-1" />{t("workspace.finalSubmit", "Final Submission")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={requestSubmit} className="font-display text-xs h-7">
              <LogOut className="w-3 h-3 mr-1" />{t("workspace.submitExit")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className={`${soloMode ? "flex-1" : "flex-[7]"} flex justify-center overflow-y-auto p-8`}>
          <div className="w-full max-w-[800px]">
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              onPaste={handlePaste}
              readOnly={isSubmitted}
              placeholder={t("workspace.begin", { topic })}
              className={`w-full h-full min-h-[calc(100vh-8rem)] resize-none bg-transparent focus-editor ${SIZE_CLASS[textSize]} outline-none placeholder:text-muted-foreground/50 ${isSubmitted ? "cursor-not-allowed opacity-90" : ""}`}
              autoFocus
            />
          </div>
        </div>

        {!soloMode && (
          <div className="flex-[3] min-w-[300px] max-w-[400px]">
            <AITutorSidebar
              essayId={essayId!}
              topic={topic}
              subject={subject}
              currentDraft={essay}
              restoredChatHistory={chatHistory}
              onChatHistoryChange={setChatHistory}
              disabled={isSubmitted}
            />
          </div>
        )}
      </div>

      <ExitModal open={showExit} onClose={() => setShowExit(false)} essayContent={essay} essayId={essayId} soloMode={soloMode} />

      <Dialog open={showLowWords} onOpenChange={setShowLowWords}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t("workspace.emptyTitle", "Essay is nearly empty")}</DialogTitle>
            <DialogDescription className="font-display">
              {t("workspace.emptyBody", "Your essay is currently empty. Would you like to save this topic as a draft to write later?")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={saving} onClick={() => setShowLowWords(false)} className="font-display">
              {t("workspace.keepWriting", "Keep writing")}
            </Button>
            <Button disabled={saving} onClick={() => saveDraft(true)} className="font-display">
              <Save className="w-4 h-4 mr-1" />{t("workspace.saveDraft", "Save Draft & Pause")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentWorkspace;