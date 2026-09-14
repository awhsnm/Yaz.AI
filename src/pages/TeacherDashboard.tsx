import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Search, FileText, CheckCircle2, Clock, Plus,
  Copy, KeyRound, Power,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import UserMenu from "@/components/UserMenu";

interface Classroom {
  id: string;
  access_code: string;
  is_active: boolean;
  name: string | null;
  created_at: string;
}

interface EssayRow {
  id: string;
  topic: string;
  subject: string;
  content: string;
  is_submitted: boolean;
  updated_at: string;
  student_id: string;
  classroom_id: string | null;
  shared_with_classroom_id: string | null;
  visibility: "private" | "shared" | "submitted" | "returned" | "graded";
  shared_at: string | null;
  submitted_at: string | null;
  assignment_id: string | null;
  assignment_title?: string | null;
  student_name: string | null;
}

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "shared", label: "Shared drafts" },
  { key: "submitted", label: "Submitted" },
  { key: "returned", label: "Returned for revision" },
  { key: "graded", label: "Graded" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  shared: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  submitted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  returned: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  graded: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [rows, setRows] = useState<EssayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [lessonName, setLessonName] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | "all">("all");
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});
  const [shared, setShared] = useState<{ id: string; title: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [studentFilter, setStudentFilter] = useState<string>("all");

  const load = useCallback(async () => {
    if (!user) return;

    // Assignments explicitly shared with this account as an accepted reviewer.
    const { data: collab } = await supabase
      .from("assignment_collaborators")
      .select("assignment_id")
      .eq("collaborator_user_id", user.id)
      .eq("status", "accepted");
    const sharedIds = (collab ?? []).map((r) => r.assignment_id);
    if (sharedIds.length) {
      const { data: sa } = await supabase.from("assignments").select("id, title").in("id", sharedIds);
      setShared((sa ?? []) as { id: string; title: string }[]);
    } else {
      setShared([]);
    }

    const { data: c } = await supabase
      .from("classrooms")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    const classroomIds = (c ?? []).map((x) => x.id);
    setClassrooms((c ?? []) as Classroom[]);

    // Privacy: only classroom essays from this teacher's own lessons.
    // Solo Practice and Brainstorm drafts (classroom_id IS NULL) stay private to the student.
    if (classroomIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Private drafts are never fetched: only essays a student actively shared or submitted.
    const idList = `(${classroomIds.join(",")})`;
    const [{ data: e }, { data: profiles }] = await Promise.all([
      supabase
        .from("essays")
        .select("id, topic, subject, content, is_submitted, updated_at, student_id, classroom_id, shared_with_classroom_id, visibility, shared_at, submitted_at, assignment_id")
        .neq("visibility", "private")
        .or(`classroom_id.in.${idList},shared_with_classroom_id.in.${idList}`)
        .order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const map = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const { data: asg } = await supabase
      .from("assignments")
      .select("id, classroom_id, title")
      .in("classroom_id", classroomIds);
    const titles = new Map((asg ?? []).map((a) => [a.id, a.title]));
    setRows((e ?? []).map((r) => ({
      ...r,
      student_name: map.get(r.student_id) ?? null,
      assignment_title: r.assignment_id ? titles.get(r.assignment_id) ?? null : null,
    })) as EssayRow[]);

    const counts: Record<string, number> = {};
    (asg ?? []).forEach((a) => { counts[a.classroom_id] = (counts[a.classroom_id] ?? 0) + 1; });
    setAssignmentCounts(counts);
    setLoading(false);
  }, [user]);


  useEffect(() => { load(); }, [load]);

  // Realtime feed for essay updates
  useEffect(() => {
    const ch = supabase
      .channel("teacher-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "essays" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const createClassroom = async () => {
    if (!user) return;
    setBusy(true);
    const code = genCode();
    const { data, error } = await supabase
      .from("classrooms")
      .insert({
        teacher_id: user.id,
        access_code: code,
        name: lessonName.trim() || `Lesson ${new Date().toLocaleDateString()}`,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      toast({ title: "Could not create lesson", description: error?.message, variant: "destructive" });
      return;
    }
    setClassrooms((cs) => [data as Classroom, ...cs]);
    setLessonName("");
    setOpenNew(false);
    setActiveFilter(data.id);
    toast({ title: t("teacher.lessonStarted"), description: `Code: ${code}` });
  };

  const toggleActive = async (c: Classroom) => {
    const { error } = await supabase
      .from("classrooms")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setClassrooms((cs) => cs.map((x) => (x.id === c.id ? { ...x, is_active: !c.is_active } : x)));
  };

  const finalizeEssay = async (id: string) => {
    const { error } = await supabase.from("essays").update({ is_submitted: true }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: t("teacher.essayFinalized") });
    load();
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      const room = r.shared_with_classroom_id ?? r.classroom_id;
      if (activeFilter !== "all" && room !== activeFilter) return false;
      if (statusFilter !== "all" && r.visibility !== statusFilter) return false;
      if (studentFilter !== "all" && r.student_id !== studentFilter) return false;
      if (!t) return true;
      return (
        r.topic.toLowerCase().includes(t) ||
        r.subject.toLowerCase().includes(t) ||
        (r.student_name ?? "").toLowerCase().includes(t)
      );
    });
  }, [rows, q, activeFilter, statusFilter, studentFilter]);

  const students = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => {
      const room = r.shared_with_classroom_id ?? r.classroom_id;
      if (activeFilter !== "all" && room !== activeFilter) return;
      seen.set(r.student_id, r.student_name ?? t("teacher.unknown"));
    });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, activeFilter, t]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground">{t("teacher.title")}</h1>
              <p className="text-xs text-muted-foreground font-display">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />{t("teacher.startLesson")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("teacher.newLesson")}</DialogTitle></DialogHeader>
                <div>
                  <Label>{t("teacher.lessonNameOpt")}</Label>
                  <Input value={lessonName} onChange={(e) => setLessonName(e.target.value)} placeholder={t("teacher.lessonNamePh")} />
                </div>
                <DialogFooter>
                  <Button onClick={createClassroom} disabled={busy}>{t("teacher.generateCode")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Classrooms */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">{t("teacher.lessonCodes")}</h2>
          </div>
          {classrooms.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground font-display">
              {t("teacher.noLessons")} <span className="font-semibold text-foreground">{t("teacher.startLesson")}</span> {t("teacher.toGenerate")}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classrooms.map((c) => {
                const classEssays = rows.filter((r) => r.classroom_id === c.id);
                const liveCount = new Set(classEssays.map((r) => r.student_id)).size;
                const submittedCount = classEssays.filter((r) => r.is_submitted).length;
                return (
                  <div key={c.id} className={`bg-card border rounded-lg p-4 ${activeFilter === c.id ? "border-primary" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold text-foreground truncate">{c.name ?? "Lesson"}</p>
                        <p className="font-mono text-2xl font-bold tracking-widest text-primary mt-1">{c.access_code}</p>
                      </div>
                      <Badge variant={c.is_active ? "default" : "outline"} className="font-display text-xs">
                        {c.is_active ? t("teacher.active") : t("teacher.inactive")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-display mt-2">
                      {liveCount} {t("teacher.students")} · {assignmentCounts[c.id] ?? 0} assignments · {submittedCount} submitted
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                        navigator.clipboard.writeText(c.access_code);
                        toast({ title: t("teacher.codeCopied") });
                      }}>
                        <Copy className="w-3 h-3 mr-1" />{t("teacher.copy")}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggleActive(c)}>
                        <Power className="w-3 h-3 mr-1" />{c.is_active ? t("teacher.deactivate") : t("teacher.reactivate")}
                      </Button>
                      <Button size="sm" variant={activeFilter === c.id ? "default" : "ghost"} className="h-7 text-xs ml-auto"
                        onClick={() => setActiveFilter(activeFilter === c.id ? "all" : c.id)}>
                        {activeFilter === c.id ? t("teacher.showing") : t("teacher.filter")}
                      </Button>
                    </div>
                    <Button size="sm" className="w-full h-8 text-xs mt-2" onClick={() => navigate(`/classroom/${c.id}`)}>
                      Open classroom
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {shared.length > 0 && (
          <section>
            <h2 className="font-display font-bold text-foreground mb-4">Shared with me</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {shared.map((a) => (
                <button key={a.id} onClick={() => navigate(`/assignment/${a.id}`)}
                  className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors">
                  <h3 className="font-display font-semibold text-foreground truncate">{a.title}</h3>
                  <p className="text-xs font-display text-muted-foreground mt-1">
                    <span className="mr-1">🟢</span>Reviewer access · student essays and feedback
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Live feed */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-display font-semibold text-foreground">
              {t("teacher.live")} {activeFilter !== "all" && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {classrooms.find((c) => c.id === activeFilter)?.name ?? "Lesson"}
                </span>
              )}
            </h2>
            {activeFilter !== "all" && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveFilter("all")}>
                {t("teacher.showAll")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("teacher.search")}
                className="pl-9"
              />
            </div>
            <span className="text-xs text-muted-foreground font-display">
              {filtered.length} of {rows.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {STATUS_TABS.map((s) => (
              <Button key={s.key} size="sm" variant={statusFilter === s.key ? "default" : "outline"}
                className="h-7 text-xs font-display" onClick={() => setStatusFilter(s.key)}>
                {s.label}
                {s.key !== "all" && (
                  <span className="ml-1 opacity-70">{rows.filter((r) => r.visibility === s.key).length}</span>
                )}
              </Button>
            ))}
            {students.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 ml-auto">
                <Button size="sm" variant={studentFilter === "all" ? "secondary" : "ghost"}
                  className="h-7 text-xs font-display" onClick={() => setStudentFilter("all")}>
                  All students
                </Button>
                {students.map(([id, name]) => (
                  <Button key={id} size="sm" variant={studentFilter === id ? "secondary" : "ghost"}
                    className="h-7 text-xs font-display" onClick={() => setStudentFilter(id)}>
                    {name}
                  </Button>
                ))}
              </div>
            )}
          </div>


          {loading ? (
            <p className="text-muted-foreground font-display">{t("common.loading")}</p>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-10 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-display">{t("teacher.noView")}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((r) => {
                const wc = r.content.trim().split(/\s+/).filter(Boolean).length;
                return (
                  <div
                    key={r.id}
                    className="bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors flex items-start justify-between gap-4"
                  >
                    <button onClick={() => navigate(`/review/${r.id}`)} className="text-left min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display font-semibold text-foreground truncate">
                          {r.student_name ?? t("teacher.unknown")}
                        </h3>
                        <Badge variant="outline" className="font-display text-xs">{r.subject}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-display truncate">{r.topic || "Untitled"}</p>
                      {r.assignment_title && (
                        <p className="text-xs text-primary font-display mt-0.5 truncate">{r.assignment_title}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-display mt-1">
                        {wc} {t("common.words")} · shared {shortDate(r.shared_at)} · submitted {shortDate(r.submitted_at)} · edited {shortDate(r.updated_at)}
                      </p>
                    </button>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-display font-medium ${STATUS_STYLE[r.visibility] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_TABS.find((s) => s.key === r.visibility)?.label ?? r.visibility}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-display">
                        {r.is_submitted ? (
                          <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3.5 h-3.5" />{t("teacher.finalized")}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5" />{t("teacher.inProgress")}</span>
                        )}
                      </span>
                      {!r.is_submitted && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => finalizeEssay(r.id)}>
                          {t("teacher.approve")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TeacherDashboard;