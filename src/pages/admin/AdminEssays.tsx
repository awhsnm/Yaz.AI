import { useCallback, useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logRequestError } from "@/lib/logError";

interface EssayRow {
  id: string;
  student_id: string;
  topic: string;
  subject: string;
  content: string;
  mode: string;
  is_submitted: boolean;
  updated_at: string;
}
interface Msg { id: string; sender: string; content: string; created_at: string }
interface Coach {
  id: string; question_shown: string | null; user_action: string | null;
  reflection_response: string | null; word_count: number; created_at: string; suppressed_reason: string | null;
}

const PAGE_SIZE = 50;
const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

const AdminEssays = () => {
  const [rows, setRows] = useState<EssayRow[]>([]);
  const [total, setTotal] = useState(0);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState("all");
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState("");
  const [selected, setSelected] = useState<EssayRow | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [coach, setCoach] = useState<Coach[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let studentIds: string[] | null = null;
    if (student.trim()) {
      const { data: ps } = await supabase.from("profiles").select("id").ilike("full_name", `%${student.trim()}%`);
      studentIds = (ps ?? []).map((p: { id: string }) => p.id);
      if (!studentIds.length) { setRows([]); setTotal(0); setLoading(false); return; }
    }
    let q = supabase
      .from("essays")
      .select("id,student_id,topic,subject,content,mode,is_submitted,updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (mode !== "all") q = q.eq("mode", mode);
    if (search.trim()) q = q.ilike("topic", `%${search.trim()}%`);
    if (studentIds) q = q.in("student_id", studentIds);

    const { data, error, count } = await q;
    if (error) {
      setLoading(false);
      logRequestError("admin-essays", error);
      setFailed(true);
      return;
    }
    setFailed(false);
    const list = (data ?? []) as EssayRow[];
    setRows(list);
    setTotal(count ?? 0);

    const ids = Array.from(new Set(list.map((r) => r.student_id)));
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
        map[p.id] = p.full_name || "Unnamed student";
      });
      setNames(map);
    }
    setLoading(false);
  }, [page, mode, search, student]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [mode, search, student]);

  const open = async (r: EssayRow) => {
    setSelected(r);
    setLogsLoading(true);
    const [m, c] = await Promise.all([
      supabase.from("messages").select("id,sender,content,created_at").eq("essay_id", r.id).order("created_at"),
      supabase.from("coach_interventions")
        .select("id,question_shown,user_action,reflection_response,word_count,created_at,suppressed_reason")
        .eq("essay_id", r.id).order("created_at"),
    ]);
    setMsgs((m.data ?? []) as Msg[]);
    setCoach((c.data ?? []) as Coach[]);
    setLogsLoading(false);
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to all essays
        </Button>
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <article className="rounded-xl border border-border bg-card p-6 space-y-4">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{selected.topic}</h2>
              <p className="text-xs text-muted-foreground">
                {names[selected.student_id] ?? "Student"} · {selected.subject} · {selected.mode} ·{" "}
                {countWords(selected.content)} words · {selected.is_submitted ? "Submitted" : "In progress"} ·{" "}
                {new Date(selected.updated_at).toLocaleString()}
              </p>
            </header>
            <div className="whitespace-pre-wrap leading-relaxed text-foreground text-sm">
              {selected.content || "This essay is still empty."}
            </div>
          </article>

          <aside className="rounded-xl border border-border bg-card p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="font-semibold text-foreground text-sm">AI log</h3>
            {logsLoading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
            ) : (
              <>
                <section className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Tutor chat ({msgs.length})</p>
                  {msgs.length === 0 && <p className="text-xs text-muted-foreground">No chat messages.</p>}
                  {msgs.map((m) => (
                    <div key={m.id} className={`rounded-lg p-2 text-sm ${m.sender === "ai" ? "bg-muted" : "bg-primary/10"}`}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">
                        {m.sender === "ai" ? "AI" : "Student"} · {new Date(m.created_at).toLocaleString()}
                      </p>
                      <p className="whitespace-pre-wrap text-foreground">{m.content}</p>
                    </div>
                  ))}
                </section>
                <section className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Coach questions ({coach.length})</p>
                  {coach.length === 0 && <p className="text-xs text-muted-foreground">No coach questions.</p>}
                  {coach.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-2 text-sm space-y-1">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleString()} · {c.word_count} words · {c.user_action ?? (c.suppressed_reason ? "not shown" : "no action")}
                      </p>
                      <p className="text-foreground">{c.question_shown ?? "—"}</p>
                      {c.reflection_response && <p className="text-muted-foreground italic">Answer: {c.reflection_response}</p>}
                    </div>
                  ))}
                </section>
              </>
            )}
          </aside>
        </div>
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="classroom">Classroom</SelectItem>
              <SelectItem value="solo">Solo practice</SelectItem>
              <SelectItem value="brainstorm">Brainstorm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="essay-search">Search topic</Label>
          <Input id="essay-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type part of a topic" />
        </div>
        <div>
          <Label htmlFor="student-search">Search student</Label>
          <Input id="student-search" value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Student name" />
        </div>
      </section>

      {!loading && !failed && <p className="text-sm text-muted-foreground">{total} essays in total</p>}

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : failed ? (
        <div className="p-6 text-sm text-muted-foreground space-y-3 rounded-xl border border-border bg-card">
          <p>We couldn't load essays just now.</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground rounded-xl border border-border bg-card">No essays match these filters.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => void open(r)}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{r.topic}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{r.mode}</span>
                {r.is_submitted && <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">Submitted</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {names[r.student_id] ?? "Student"} · {countWords(r.content)} words · {new Date(r.updated_at).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
        <span className="text-xs text-muted-foreground">Page {page + 1} of {pages}</span>
        <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
};

export default AdminEssays;
