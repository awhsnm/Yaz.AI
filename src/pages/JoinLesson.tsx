import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, ArrowLeft, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUBJECTS = ["English", "Russian Literature", "Kazakh Literature", "General"];

const JoinLesson = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [code, setCode] = useState("");
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [classroomName, setClassroomName] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const validateCode = async () => {
    setError("");
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError(t("join.codeLen"));
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase
      .from("classrooms")
      .select("id, name, is_active")
      .eq("access_code", trimmed)
      .maybeSingle();
    setBusy(false);
    if (err || !data || !data.is_active) {
      setError(t("join.invalid"));
      return;
    }
    setClassroomId(data.id);
    setClassroomName(data.name ?? "Lesson");
  };

  const startEssay = async () => {
    if (!user || !classroomId || !topic.trim() || !subject) return;
    setBusy(true);
    const { data, error: err } = await supabase
      .from("essays")
      .insert({ student_id: user.id, topic: topic.trim(), subject, classroom_id: classroomId })
      .select()
      .single();
    setBusy(false);
    if (err || !data) {
      toast({ title: t("join.couldNotStart"), description: err?.message, variant: "destructive" });
      return;
    }
    navigate(`/essay/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student-dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-display font-bold text-foreground">{t("join.title")}</h1>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {!classroomId ? (
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
              </div>
              <h2 className="text-center font-display font-bold text-xl text-foreground mb-1">
                {t("join.enterCode")}
              </h2>
              <p className="text-center text-sm text-muted-foreground font-display mb-6">
                {t("join.helper")}
              </p>
              <Input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && validateCode()}
                maxLength={6}
                placeholder="ABC123"
                className="text-center text-2xl tracking-[0.5em] font-display font-bold h-14 uppercase"
                autoFocus
              />
              {error && <p className="text-destructive text-sm font-display mt-3 text-center">{error}</p>}
              <Button onClick={validateCode} disabled={busy || code.trim().length !== 6} className="w-full mt-6 font-display">
                {t("join.validate")}
              </Button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-success" />
                </div>
              </div>
              <h2 className="text-center font-display font-bold text-xl text-foreground mb-1">
                {t("join.joined")}: {classroomName}
              </h2>
              <p className="text-center text-sm text-muted-foreground font-display mb-6">
                {t("join.setTopic")}
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="font-display">{t("join.topic")}</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("join.topicPh")} />
                </div>
                <div>
                  <Label className="font-display">{t("join.subject")}</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger><SelectValue placeholder={t("join.selectSubject")} /></SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={startEssay}
                  disabled={busy || !topic.trim() || !subject}
                  className="w-full font-display"
                >
                  {t("join.start")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinLesson;