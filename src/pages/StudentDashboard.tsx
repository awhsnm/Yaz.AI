import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, CheckCircle2, Clock, Award, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import ModeCards from "@/components/ModeCards";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Essay {
  id: string;
  topic: string;
  subject: string;
  content: string;
  is_submitted: boolean;
  updated_at: string;
  mode: string;
  classroom_id: string | null;
  pinned: boolean;
  evaluated?: boolean;
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [essays, setEssays] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      setFullName(prof?.full_name ?? "");

      const { data } = await supabase
        .from("essays")
        .select("id, topic, subject, content, is_submitted, updated_at, mode, classroom_id, pinned")
        .eq("student_id", user.id)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      const list = (data ?? []) as Essay[];
      if (list.length) {
        const { data: evals } = await supabase
          .from("evaluations")
          .select("essay_id")
          .in("essay_id", list.map((e) => e.id));
        const evalSet = new Set((evals ?? []).map((x) => x.essay_id));
        setEssays(list.map((e) => ({ ...e, evaluated: evalSet.has(e.id) })));
      } else {
        setEssays([]);
      }
      setLoading(false);
    })();
  }, [user]);

  const togglePin = async (essay: Essay) => {
    const next = !essay.pinned;
    setEssays((prev) => {
      const updated = prev.map((e) => (e.id === essay.id ? { ...e, pinned: next } : e));
      return [...updated].sort((a, b) =>
        a.pinned === b.pinned ? +new Date(b.updated_at) - +new Date(a.updated_at) : a.pinned ? -1 : 1
      );
    });
    const { error } = await supabase.from("essays").update({ pinned: next }).eq("id", essay.id);
    if (error) toast({ title: t("common.error", "Something went wrong"), description: error.message, variant: "destructive" });
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    const { error } = await supabase.from("essays").delete().eq("id", id);
    if (error) {
      toast({ title: t("common.error", "Something went wrong"), description: error.message, variant: "destructive" });
      return;
    }
    setEssays((prev) => prev.filter((e) => e.id !== id));
    toast({ title: t("dashboard.deleted", "Draft deleted") });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("greet.morning");
    if (h < 18) return t("greet.day");
    return t("greet.evening");
  };
  const displayName = fullName || user?.email?.split("@")[0] || "";

  return (
    <div className="min-h-screen bg-background">
      <BirthdayOverlay />
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground">{t("dashboard.title")}</h1>
              <p className="text-xs text-muted-foreground font-display">{user?.email}</p>
            </div>
          </div>
          <UserMenu />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="font-display font-bold text-2xl text-foreground">
            {greeting()}{displayName ? `, ${displayName}` : ""}!
          </h2>
        </div>

        <ModeCards />

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-foreground">{t("dashboard.drafts")}</h2>
        </div>

        {loading ? (
          <p className="text-muted-foreground font-display">{t("common.loading")}</p>
        ) : essays.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-display">{t("dashboard.noEssays")}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {essays.map((e) => {
              const wc = e.content.trim().split(/\s+/).filter(Boolean).length;
              const mode = e.mode ?? (e.classroom_id ? "classroom" : "solo");
              const isClassroom = mode === "classroom";
              const isBrainstorm = mode === "brainstorm";
              const cardStyle = isClassroom
                ? "bg-primary/5 border-primary/40"
                : isBrainstorm
                ? "bg-success/5 border-success/40"
                : "bg-card border-border";
              return (
                <div
                  key={e.id}
                  className={`rounded-lg border transition-colors hover:border-primary ${cardStyle}`}
                >
                  <div className="flex items-start gap-2 p-4">
                    <button
                      onClick={() => navigate(
                        e.is_submitted && e.mode === "solo"
                          ? `/evaluation/${e.id}`
                          : e.is_submitted || e.evaluated
                            ? `/feedback/${e.id}`
                            : `/essay/${e.id}`
                      )}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2 mb-1 text-xs font-display">
                        {isClassroom && e.evaluated ? (
                          <span className="flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 font-semibold"><Award className="w-3.5 h-3.5" />{t("dashboard.evaluated")}</span>
                        ) : e.is_submitted ? (
                          <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3.5 h-3.5" />{t("dashboard.submitted")}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5" />{t("dashboard.draft")}</span>
                        )}
                        {e.pinned && <Pin className="w-3 h-3 text-primary fill-primary" />}
                      </div>
                      <h3 className="font-display font-semibold text-foreground truncate">{e.topic || "Untitled"}</h3>
                      <p className="text-xs text-muted-foreground font-display mt-0.5">
                        {isClassroom && <span className="text-primary font-semibold">{t("modes.classroomTitle")} • </span>}
                        {isBrainstorm && <span className="text-success font-semibold">{t("modes.brainTitle")} • </span>}
                        {e.subject} • {wc} {t("common.words")}
                      </p>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label={t("dashboard.actions", "Essay actions")}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem className="font-display" onClick={() => togglePin(e)}>
                          {e.pinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                          {e.pinned ? t("dashboard.unpin", "Unpin") : t("dashboard.pin", "Pin to top")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="font-display text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(e.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />{t("dashboard.delete", "Delete draft")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t("dashboard.deleteTitle", "Delete this draft?")}</AlertDialogTitle>
            <AlertDialogDescription className="font-display">
              {t("dashboard.deleteBody", "This permanently removes the essay and its chat history. This cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display">{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="font-display bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("dashboard.delete", "Delete draft")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentDashboard;
