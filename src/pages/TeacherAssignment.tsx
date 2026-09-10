import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  id: string;
  topic: string;
  student_id: string;
  content: string;
  is_submitted: boolean;
  updated_at: string;
  student_name: string | null;
  grade: string | null;
}

type Filter = "all" | "in_progress" | "submitted" | "locked";
type Sort = "student" | "submitted_at" | "activity" | "words" | "grade";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const TeacherAssignment = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [enrolled, setEnrolled] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("student");

  const load = useCallback(async () => {
    if (!id) return;
    const { data: a } = await supabase
      .from("assignments")
      .select("id, title, classroom_id")
      .eq("id", id)
      .maybeSingle();
    if (!a) { setLoading(false); return; }
    setTitle(a.title);
    setClassroomId(a.classroom_id);

    const [{ data: e }, { data: profiles }, { data: classEssays }] = await Promise.all([
      supabase.from("essays").select("id, topic, student_id, content, is_submitted, updated_at").eq("assignment_id", id),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("essays").select("student_id").eq("classroom_id", a.classroom_id),
    ]);
    const ids = (e ?? []).map((x) => x.id);
    const { data: evals } = ids.length
      ? await supabase.from("evaluations").select("essay_id, grade").in("essay_id", ids)
      : { data: [] as { essay_id: string; grade: string }[] };
    const gradeMap = new Map((evals ?? []).map((v) => [v.essay_id, v.grade]));
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    setEnrolled(new Set((classEssays ?? []).map((r) => r.student_id)).size);
    setRows((e ?? []).map((r) => ({
      ...r,
      student_name: nameMap.get(r.student_id) ?? null,
      grade: gradeMap.get(r.id) ?? null,
    })));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const notStarted = Math.max(enrolled - rows.length, 0);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (filter === "submitted" && !r.is_submitted) return false;
      if (filter === "locked" && !r.is_submitted) return false;
      if (filter === "in_progress" && r.is_submitted) return false;
      if (!term) return true;
      return (r.student_name ?? "").toLowerCase().includes(term) || r.topic.toLowerCase().includes(term);
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "words": return words(b.content) - words(a.content);
        case "grade": return (b.grade ?? "").localeCompare(a.grade ?? "");
        case "submitted_at":
        case "activity": return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default: return (a.student_name ?? "").localeCompare(b.student_name ?? "");
      }
    });
    return sorted;
  }, [rows, q, filter, sort]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => classroomId ? navigate(`/classroom/${classroomId}`) : navigate("/teacher-dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-foreground truncate">{title || "Assignment"}</h1>
            <p className="text-xs text-muted-foreground font-display">
              {rows.filter((r) => r.is_submitted).length} submitted · {rows.filter((r) => !r.is_submitted).length} in progress · {notStarted} not started
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or essay title…" className="pl-9" />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Sort: student name</SelectItem>
              <SelectItem value="submitted_at">Sort: submission date</SelectItem>
              <SelectItem value="activity">Sort: last activity</SelectItem>
              <SelectItem value="words">Sort: word count</SelectItem>
              <SelectItem value="grade">Sort: grade</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-muted-foreground font-display">Loading...</p>
        ) : visible.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-display">No student essays match this view.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visible.map((r) => (
              <button key={r.id} onClick={() => navigate(`/review/${r.id}`)}
                className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-foreground truncate">{r.student_name ?? "Unknown student"}</h3>
                  <p className="text-sm text-muted-foreground font-display truncate">{r.topic || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground font-display mt-1">
                    {words(r.content)} words · last saved {new Date(r.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge variant={r.is_submitted ? "default" : "outline"} className="font-display text-xs">
                    {r.is_submitted ? "Submitted" : "In progress"}
                  </Badge>
                  {r.grade && <span className="text-xs font-display text-muted-foreground">Grade: {r.grade}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherAssignment;
