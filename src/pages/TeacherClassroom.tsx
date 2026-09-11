import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Users, FileText, Archive, Eye, EyeOff, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ManageCollaborators, { SharedBadge, useCollaborators } from "@/components/ManageCollaborators";

interface Assignment {
  id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  prompt: string | null;
  instructions: string | null;
  time_limit_minutes: number | null;
  subject: string;
  is_published: boolean;
  is_archived: boolean;
  created_at: string;
}

interface EssayLite {
  id: string;
  student_id: string;
  assignment_id: string | null;
  is_submitted: boolean;
  content: string;
}

const SUBJECTS = ["English", "Russian Literature", "Kazakh Literature", "General"];

const emptyForm = { title: "", description: "", prompt: "", instructions: "", time_limit_minutes: 45, subject: "English" };

const TeacherClassroom = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [classroom, setClassroom] = useState<{ id: string; name: string | null; access_code: string } | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [essays, setEssays] = useState<EssayLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [collabFor, setCollabFor] = useState<string | null>(null);
  const assignmentIds = useMemo(() => assignments.map((a) => a.id), [assignments]);
  const { map: collabMap, reload: reloadCollabs } = useCollaborators(assignmentIds);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: c }, { data: a }, { data: e }] = await Promise.all([
      supabase.from("classrooms").select("id, name, access_code").eq("id", id).maybeSingle(),
      supabase.from("assignments").select("*").eq("classroom_id", id).order("created_at"),
      supabase.from("essays").select("id, student_id, assignment_id, is_submitted, content").eq("classroom_id", id),
    ]);
    setClassroom(c ?? null);
    setAssignments((a ?? []) as Assignment[]);
    setEssays((e ?? []) as EssayLite[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const studentCount = useMemo(
    () => new Set(essays.map((e) => e.student_id)).size,
    [essays],
  );

  const statsFor = (assignmentId: string) => {
    const rows = essays.filter((e) => e.assignment_id === assignmentId);
    const submitted = rows.filter((r) => r.is_submitted).length;
    const inProgress = rows.length - submitted;
    return { started: rows.length, submitted, inProgress, notStarted: Math.max(studentCount - rows.length, 0) };
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a: Assignment) => {
    setEditing(a);
    setForm({
      title: a.title,
      description: a.description ?? "",
      prompt: a.prompt ?? "",
      instructions: a.instructions ?? "",
      time_limit_minutes: a.time_limit_minutes ?? 45,
      subject: a.subject ?? "English",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!user || !id || !form.title.trim()) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      prompt: form.prompt.trim() || null,
      instructions: form.instructions.trim() || null,
      time_limit_minutes: Number(form.time_limit_minutes) || 45,
      subject: form.subject || "English",
    };
    const { error } = editing
      ? await supabase.from("assignments").update(payload).eq("id", editing.id)
      : await supabase.from("assignments").insert({ ...payload, classroom_id: id, created_by: user.id, is_published: true });
    setBusy(false);
    if (error) {
      toast({ title: "Could not save assignment", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    void load();
  };

  const patch = async (a: Assignment, values: Partial<Assignment>) => {
    const { error } = await supabase.from("assignments").update(values).eq("id", a.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setAssignments((list) => list.map((x) => (x.id === a.id ? { ...x, ...values } : x)));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher-dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-foreground truncate">{classroom?.name ?? "Classroom"}</h1>
            <p className="text-xs text-muted-foreground font-display">
              Lesson code: <span className="font-mono font-semibold text-foreground">{classroom?.access_code ?? "—"}</span>
              {" · "}{studentCount} students
            </p>
          </div>
          <Button className="ml-auto" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Create assignment</Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-muted-foreground font-display">Loading...</p>
        ) : !classroom ? (
          <p className="text-muted-foreground font-display">Classroom not found.</p>
        ) : assignments.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-display">No assignments yet. Create your first essay topic.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {assignments.map((a) => {
              const s = statsFor(a.id);
              return (
                <div key={a.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-semibold text-foreground">{a.title}</h3>
                        <Badge variant={a.is_archived ? "outline" : a.is_published ? "default" : "secondary"} className="font-display text-xs">
                          {a.is_archived ? "Archived" : a.is_published ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      {(a.description || a.prompt) && (
                        <p className="text-sm text-muted-foreground font-display mt-1 line-clamp-2">
                          {a.description || a.prompt}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground font-display mt-2 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{studentCount} students</span>
                        <span>{s.submitted} submitted</span>
                        <span>{s.inProgress} in progress</span>
                        <span>{s.notStarted} not started</span>
                       </p>
                       <div className="mt-2"><SharedBadge collaborators={collabMap[a.id]} /></div>
                     </div>
                     <Button size="sm" onClick={() => navigate(`/assignment/${a.id}`)}>View essays</Button>
                   </div>
                   <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(a)}>
                      <Pencil className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => patch(a, { is_published: !a.is_published })}>
                      {a.is_published ? <><EyeOff className="w-3 h-3 mr-1" />Unpublish</> : <><Eye className="w-3 h-3 mr-1" />Publish</>}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => patch(a, { is_archived: !a.is_archived })}>
                      <Archive className="w-3 h-3 mr-1" />{a.is_archived ? "Unarchive" : "Archive"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCollabFor(a.id)}>
                      <UserPlus className="w-3 h-3 mr-1" />Manage collaborators
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit assignment" : "New assignment"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Essay topic / title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mindful Rest and Productivity" />
            </div>
            <div>
              <Label>Short description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Prompt (optional)</Label>
              <Textarea rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
            </div>
            <div>
              <Label>Instructions (optional)</Label>
              <Textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time limit (minutes)</Label>
              <Input type="number" min={5} value={form.time_limit_minutes}
                onChange={(e) => setForm({ ...form, time_limit_minutes: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy || !form.title.trim()}>{editing ? "Save changes" : "Create assignment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherClassroom;
