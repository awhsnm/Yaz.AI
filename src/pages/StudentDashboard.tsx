import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, CheckCircle2, Clock, Award } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import ModeCards from "@/components/ModeCards";

interface Essay {
  id: string;
  topic: string;
  subject: string;
  content: string;
  is_submitted: boolean;
  updated_at: string;
  mode: string;
  classroom_id: string | null;
  evaluated?: boolean;
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [essays, setEssays] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState<string>("");

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
        .select("id, topic, subject, content, is_submitted, updated_at, mode, classroom_id")
        .eq("student_id", user.id)
        .order("updated_at", { ascending: false });
      const list = data ?? [];
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
              const isClassroom = (e.mode ?? (e.classroom_id ? "classroom" : "solo")) === "classroom";
              return (
                <button
                  key={e.id}
                  onClick={() => navigate(e.is_submitted || e.evaluated ? `/feedback/${e.id}` : `/essay/${e.id}`)}
                  className={`rounded-lg p-4 text-left border transition-colors hover:border-primary ${
                    isClassroom ? "bg-primary/5 border-primary/40" : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-foreground truncate">{e.topic || "Untitled"}</h3>
                      <p className="text-xs text-muted-foreground font-display mt-0.5">
                        {isClassroom && <span className="text-primary font-semibold">{t("modes.classroomTitle")} • </span>}
                        {e.subject} • {wc} {t("common.words")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-display shrink-0">
                      {isClassroom && e.evaluated ? (
                        <span className="flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 font-semibold"><Award className="w-3.5 h-3.5" />{t("dashboard.evaluated")}</span>
                      ) : e.is_submitted ? (
                        <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3.5 h-3.5" />{t("dashboard.submitted")}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5" />{t("dashboard.draft")}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;