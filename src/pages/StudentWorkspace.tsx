import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shield, LogOut, Clock, BookOpen, Save, CheckCircle2, Trash2, BookMarked } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import AITutorSidebar from "@/components/AITutorSidebar";
import SocraticPrompt from "@/components/SocraticPrompt";
import ResearchConsentDialog, { CONSENT_VERSION } from "@/components/ResearchConsentDialog";
import ResearchQuestionnaire, { QuestionnaireAnswers } from "@/components/ResearchQuestionnaire";
import { useSocraticCoach } from "@/hooks/useSocraticCoach";
import ExitModal from "@/components/ExitModal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/contexts/SettingsContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TopicBrief, { TopicBriefData } from "@/components/TopicBrief";
import { supabase } from "@/integrations/supabase/client";

const SIZE_CLASS = { small: "text-base", medium: "text-lg", large: "text-2xl" } as const;

const SESSION_DURATION = 45 * 60;
const MIN_WORDS = 20;

const MODE_ACCENT: Record<string, { border: string; bgLight: string; bgDark: string; text: string } | null> = {
  brainstorm: { border: "#10B981", bgLight: "#E6F4EA", bgDark: "#052e16", text: "#10B981" },
  classroom: { border: "#2563EB", bgLight: "#EFF6FF", bgDark: "#172554", text: "#2563EB" },
  solo: null,
};

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
  const [topicBrief, setTopicBrief] = useState<TopicBriefData | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  // --- research mode (additive; false for every existing essay) ---
  const [researchMode, setResearchMode] = useState(false);
  const [consented, setConsented] = useState(true);
  const [consentSaving, setConsentSaving] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const lastSaved = useRef("");
  const lastLogged = useRef("");
  const pendingPaste = useRef(0);

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
      const brief = (e as { topic_brief?: unknown }).topic_brief;
      setTopicBrief(brief && typeof brief === "object" ? (brief as TopicBriefData) : null);
      const mins = (e as { duration_minutes?: number | null }).duration_minutes;
      if (mins && mins > 0) setRemaining(mins * 60);
      // Research mode is opt-in and off for every existing essay.
      const isResearch = !!(e as { research_mode?: boolean }).research_mode;
      setResearchMode(isResearch);
      if (isResearch) {
        const { data: p } = await supabase
          .from("research_participants")
          .select("consented_at")
          .eq("user_id", user.id)
          .maybeSingle();
        setConsented(!!p?.consented_at);
      }
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

  // Writing playback: log a snapshot every 3s while the text changes
  useEffect(() => {
    if (!essayId || !user || loading || isSubmitted) return;
    const i = setInterval(() => {
      if (essay === lastLogged.current) return;
      const snapshot = essay;
      const added = snapshot.length - lastLogged.current.length;
      const paste = pendingPaste.current > 0 || added >= 50;
      pendingPaste.current = 0;
      lastLogged.current = snapshot;
      supabase.from("writing_events").insert({
        essay_id: essayId,
        student_id: user.id,
        snapshot,
        word_count: snapshot.trim().split(/\s+/).filter(Boolean).length,
        chars_added: added,
        is_paste: paste,
      }).then(() => {});
    }, 3000);
    return () => clearInterval(i);
  }, [essay, essayId, user, loading, isSubmitted]);

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
      if (researchMode) setShowQuestionnaire(true);
      toast({ title: t("workspace.timeUp"), description: t("workspace.autoSubmitted") });
    })();
  }, [remaining, loading, isSubmitted, essay, essayId, toast, t, timed, researchMode]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    pendingPaste.current += e.clipboardData?.getData("text")?.length ?? 1;
    if (essayId && user) {
      supabase.from("writing_events").insert({
        essay_id: essayId,
        student_id: user.id,
        snapshot: essay,
        word_count: essay.trim().split(/\s+/).filter(Boolean).length,
        chars_added: e.clipboardData?.getData("text")?.length ?? 0,
        is_paste: true,
      }).then(() => {});
    }
    toast({ title: t("workspace.pasteOff"), description: t("workspace.pasteHint"), variant: "destructive" });
  }, [toast, t, essay, essayId, user]);

  const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const isTimeUp = remaining === 0;
  const isLowTime = remaining <= 300 && remaining > 0;

  // Inert unless the essay is opted into research mode.
  const coach = useSocraticCoach({
    essayId,
    researchMode,
    text: essay,
    isSubmitted,
    enabled: researchMode && consented && !loading,
  });

  const acceptConsent = async () => {
    if (!user) return;
    setConsentSaving(true);
    const { data } = await supabase.rpc("ensure_research_participant");
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      await supabase
        .from("research_participants")
        .update({ consented_at: new Date().toISOString(), consent_version: CONSENT_VERSION })
        .eq("id", (row as { id: string }).id);
    }
    setConsentSaving(false);
    setConsented(true);
  };

  const saveDraft = async (leave: boolean) => {
    if (!essayId) return;
    setSaving(true);
    await supabase.from("essays").update({ content: essay, is_submitted: false }).eq("id", essayId);
    lastSaved.current = essay;
    setSaving(false);
    setShowLowWords(false);
    coach.notifySave();
    if (leave) navigate("/student-dashboard");
    else toast({ title: t("workspace.draftSaved", "Draft saved") });
  };

  const finalSubmit = async () => {
    if (!essayId) return;
    setSaving(true);
    await supabase.from("essays").update({ content: essay, is_submitted: true }).eq("id", essayId);
    await coach.notifySubmitted();
    setSaving(false);
    setIsSubmitted(true);
    // Research pilot only: collect the post-writing questionnaire before leaving.
    if (researchMode) { setShowQuestionnaire(true); return; }
    // Solo Practice ends in the evaluation hub instead of the dashboard.
    if (mode === "solo") navigate(`/evaluation/${essayId}`);
    else navigate("/student-dashboard");
  };

  const saveQuestionnaire = async (answers: QuestionnaireAnswers | null) => {
    if (!essayId || !user) { navigate("/student-dashboard"); return; }
    setQuestionnaireSaving(true);
    if (answers) {
      const { data: p } = await supabase
        .from("research_participants")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (p?.id) {
        await supabase.from("research_questionnaires").insert([{
          essay_id: essayId,
          participant_id: p.id,
          answers: JSON.parse(JSON.stringify(answers)),
        }]);
      }
    }
    setQuestionnaireSaving(false);
    setShowQuestionnaire(false);
    navigate("/student-dashboard");
  };


  const requestSubmit = () => {
    if (wordCount < MIN_WORDS) { setShowLowWords(true); return; }
    if (mode === "brainstorm") { finalSubmit(); return; }
    if (mode === "solo") { finalSubmit(); return; }
    setShowExit(true);
  };

  const discardSession = async () => {
    if (!essayId) return;
    setSaving(true);
    await supabase.from("essays").delete().eq("id", essayId);
    setSaving(false);
    setShowDiscard(false);
    navigate("/student-dashboard");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">{t("workspace.loadingSession")}</div>;

  const modeAccent = MODE_ACCENT[mode] || null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-11 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-display font-medium ${
            mode === "brainstorm"
              ? "bg-[#E6F4EA] text-[#10B981] dark:bg-[#052e16]"
              : mode === "classroom"
              ? "bg-[#EFF6FF] text-[#2563EB] dark:bg-[#172554]"
              : "bg-success/10 text-success"
          }`}>
            <Shield className="w-3.5 h-3.5" />
            {t("workspace.focusMode")}
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
          {topicBrief && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBrief(true)}
              className="ml-2 font-display text-xs h-7"
            >
              <BookMarked className="w-3 h-3 mr-1" />
              {t("workspace.viewBrief", "View Topic Brief")}
            </Button>
          )}
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
          ) : mode === "solo" ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={saving} onClick={() => setShowDiscard(true)} className="font-display text-xs h-7 text-destructive hover:text-destructive">
                <Trash2 className="w-3 h-3 mr-1" />{t("workspace.discard", "Discard Session")}
              </Button>
              <Button size="sm" disabled={saving} onClick={requestSubmit} className="font-display text-xs h-7">
                <CheckCircle2 className="w-3 h-3 mr-1" />{t("workspace.submitEssay", "Submit Essay")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={requestSubmit} className="font-display text-xs h-7">
              <LogOut className="w-3 h-3 mr-1" />{t("workspace.submitExit")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0 bg-[#FAFAF9] dark:bg-[#0a0a0a]">
        <div className={`${mode === "solo" && !researchMode ? "flex-1" : "flex-[7]"} flex justify-center overflow-y-auto p-8`}>
          <div className={`w-full max-w-[800px] rounded-lg border-2 p-6 transition-colors ${
            modeAccent
              ? `bg-[${modeAccent.bgLight}] dark:bg-[${modeAccent.bgDark}] border-[${modeAccent.border}]`
              : "bg-background border-transparent"
          }`}>
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              onPaste={handlePaste}
              readOnly={isSubmitted || (researchMode && !consented)}
              placeholder={t("workspace.begin", { topic })}
              className={`w-full h-full min-h-[calc(100vh-11rem)] resize-none bg-transparent focus-editor ${SIZE_CLASS[textSize]} outline-none placeholder:text-muted-foreground/50 ${isSubmitted ? "cursor-not-allowed opacity-90" : ""}`}
              autoFocus
            />
          </div>
        </div>

        {researchMode ? (
          <div className="flex-[3] min-w-[300px] max-w-[400px]">
            <SocraticPrompt
              question={coach.question}
              snoozed={coach.snoozed}
              pendingRatingId={coach.pendingRatingId}
              participantCode={coach.participantCode}
              paused={coach.paused}
              busy={coach.busy}
              questionsUsed={coach.questionsUsed}
              questionsMax={coach.questionsMax}
              onTogglePause={coach.togglePause}
              onAction={coach.recordAction}
              onRate={coach.submitRating}
            />
          </div>
        ) : mode !== "solo" ? (
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
        ) : null}
      </div>

      {researchMode && (
        <ResearchConsentDialog
          open={!consented}
          submitting={consentSaving}
          onAgree={acceptConsent}
          onDecline={() => navigate("/student-dashboard")}
        />
      )}

      {researchMode && (
        <ResearchQuestionnaire
          open={showQuestionnaire}
          submitting={questionnaireSaving}
          participantCode={coach.participantCode}
          onSubmit={(answers) => saveQuestionnaire(answers)}
          onSkip={() => saveQuestionnaire(null)}
        />
      )}


      <Sheet open={showBrief} onOpenChange={setShowBrief}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display">{t("workspace.viewBrief", "View Topic Brief")}</SheetTitle>
          </SheetHeader>
          {topicBrief && <TopicBrief brief={topicBrief} />}
        </SheetContent>
      </Sheet>

      <ExitModal open={showExit} onClose={() => setShowExit(false)} essayContent={essay} essayId={essayId} soloMode={soloMode} />

      <Dialog open={showLowWords} onOpenChange={setShowLowWords}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t("workspace.emptyTitle", "Essay is nearly empty")}</DialogTitle>
            <DialogDescription className="font-display">
              {mode === "solo"
                ? t("workspace.emptySolo", "Solo Practice can't be saved as a draft. Write at least 20 words before submitting, or discard the session.")
                : t("workspace.emptyBody", "Your essay is currently empty. Would you like to save this topic as a draft to write later?")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={saving} onClick={() => setShowLowWords(false)} className="font-display">
              {t("workspace.keepWriting", "Keep writing")}
            </Button>
            {mode === "solo" ? (
              <Button variant="destructive" disabled={saving} onClick={() => { setShowLowWords(false); setShowDiscard(true); }} className="font-display">
                <Trash2 className="w-4 h-4 mr-1" />{t("workspace.discard", "Discard Session")}
              </Button>
            ) : (
              <Button disabled={saving} onClick={() => saveDraft(true)} className="font-display">
                <Save className="w-4 h-4 mr-1" />{t("workspace.saveDraft", "Save Draft & Pause")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t("workspace.discardTitle", "Discard this session?")}</AlertDialogTitle>
            <AlertDialogDescription className="font-display">
              {t("workspace.discardBody", "Your writing will be permanently deleted. This cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display">{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={discardSession} className="font-display bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("workspace.discard", "Discard Session")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentWorkspace;