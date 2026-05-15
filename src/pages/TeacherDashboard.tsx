import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, LogOut, Search, FileText, CheckCircle2, Clock, Plus,
  Copy, KeyRound, Power, ShieldCheck,
} from "lucide-react";
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

interface Classroom {
  id: string;
  access_code: string;
  is_active: boolean;
  exit_password: string | null;
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
  student_name: string | null;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
const genExitPassword = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

const TeacherDashboard = () => {
  const { user, signOut } = useAuth();
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

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: c }, { data: e }, { data: profiles }] = await Promise.all([
      supabase.from("classrooms").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false }),
      supabase.from("essays").select("id, topic, subject, content, is_submitted, updated_at, student_id, classroom_id").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const map = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    setClassrooms((c ?? []) as Classroom[]);
    setRows((e ?? []).map((r) => ({ ...r, student_name: map.get(r.student_id) ?? null })));
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
    const exit = genExitPassword();
    const { data, error } = await supabase
      .from("classrooms")
      .insert({
        teacher_id: user.id,
        access_code: code,
        exit_password: exit,
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
    toast({ title: "Lesson started", description: `Code: ${code}` });
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
    toast({ title: "Essay finalized" });
    load();
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeFilter !== "all" && r.classroom_id !== activeFilter) return false;
      if (!t) return true;
      return (
        r.topic.toLowerCase().includes(t) ||
        r.subject.toLowerCase().includes(t) ||
        (r.student_name ?? "").toLowerCase().includes(t)
      );
    });
  }, [rows, q, activeFilter]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground">Teacher Dashboard</h1>
              <p className="text-xs text-muted-foreground font-display">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Start New Lesson</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Lesson</DialogTitle></DialogHeader>
                <div>
                  <Label>Lesson name (optional)</Label>
                  <Input value={lessonName} onChange={(e) => setLessonName(e.target.value)} placeholder="e.g., Period 3 — Macbeth" />
                </div>
                <DialogFooter>
                  <Button onClick={createClassroom} disabled={busy}>Generate Access Code</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 mr-2" />Sign out</Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Classrooms */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Lesson Codes</h2>
          </div>
          {classrooms.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground font-display">
              No lessons yet. Click <span className="font-semibold text-foreground">Start New Lesson</span> to generate a code.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classrooms.map((c) => {
                const liveCount = rows.filter((r) => r.classroom_id === c.id).length;
                return (
                  <div key={c.id} className={`bg-card border rounded-lg p-4 ${activeFilter === c.id ? "border-primary" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold text-foreground truncate">{c.name ?? "Lesson"}</p>
                        <p className="font-mono text-2xl font-bold tracking-widest text-primary mt-1">{c.access_code}</p>
                      </div>
                      <Badge variant={c.is_active ? "default" : "outline"} className="font-display text-xs">
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-display mt-2 flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" />
                      Exit: <span className="font-mono font-semibold text-foreground">{c.exit_password}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-display mt-1">{liveCount} student(s)</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                        navigator.clipboard.writeText(c.access_code);
                        toast({ title: "Code copied" });
                      }}>
                        <Copy className="w-3 h-3 mr-1" />Copy
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggleActive(c)}>
                        <Power className="w-3 h-3 mr-1" />{c.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                      <Button size="sm" variant={activeFilter === c.id ? "default" : "ghost"} className="h-7 text-xs ml-auto"
                        onClick={() => setActiveFilter(activeFilter === c.id ? "all" : c.id)}>
                        {activeFilter === c.id ? "Showing" : "Filter"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Live feed */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-display font-semibold text-foreground">
              Live Monitoring {activeFilter !== "all" && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {classrooms.find((c) => c.id === activeFilter)?.name ?? "Lesson"}
                </span>
              )}
            </h2>
            {activeFilter !== "all" && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveFilter("all")}>
                Show all
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by student, topic, subject..."
                className="pl-9"
              />
            </div>
            <span className="text-xs text-muted-foreground font-display">
              {filtered.length} of {rows.length}
            </span>
          </div>

          {loading ? (
            <p className="text-muted-foreground font-display">Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-10 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-display">No essays in this view yet.</p>
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
                          {r.student_name ?? "Unknown student"}
                        </h3>
                        <Badge variant="outline" className="font-display text-xs">{r.subject}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-display truncate">{r.topic || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground font-display mt-1">{wc} words</p>
                    </button>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-xs font-display">
                        {r.is_submitted ? (
                          <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3.5 h-3.5" />Finalized</span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5" />In progress</span>
                        )}
                      </span>
                      {!r.is_submitted && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => finalizeEssay(r.id)}>
                          Approve & Finalize
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