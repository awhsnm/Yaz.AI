import { useCallback, useEffect, useMemo, useState } from "react";
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

const PAGE_SIZE = 20;

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

const AdminEssays = () => {
  const [rows, setRows] = useState<EssayRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [mode, setMode] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EssayRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("essays")
      .select("id,student_id,topic,subject,content,mode,is_submitted,updated_at")
      .order("updated_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    if (mode !== "all") q = q.eq("mode", mode);
    if (search.trim()) q = q.ilike("topic", `%${search.trim()}%`);

    const { data, error } = await q;
    if (error) {
      setLoading(false);
      logRequestError("admin-essays", error);
      setFailed(true);
      return;
    }
    setFailed(false);
    const list = (data ?? []) as EssayRow[];
    setHasMore(list.length > PAGE_SIZE);
    const visible = list.slice(0, PAGE_SIZE);
    setRows(visible);

    const ids = Array.from(new Set(visible.map((r) => r.student_id)));
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
        map[p.id] = p.full_name || "Unnamed student";
      });
      setNames(map);
    }
    setLoading(false);
  }, [page, mode, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [mode, search]);

  const selectedWords = useMemo(() => (selected ? countWords(selected.content) : 0), [selected]);

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to all essays
        </Button>
        <article className="rounded-xl border border-border bg-card p-6 space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{selected.topic}</h2>
            <p className="text-xs text-muted-foreground">
              {names[selected.student_id] ?? "Student"} · {selected.subject} · {selected.mode} ·{" "}
              {selectedWords} words · {selected.is_submitted ? "Submitted" : "In progress"} ·{" "}
              {new Date(selected.updated_at).toLocaleString()}
            </p>
          </header>
          <div className="whitespace-pre-wrap leading-relaxed text-foreground text-sm">
            {selected.content || "This essay is still empty."}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
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
          <Input
            id="essay-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type part of a topic"
          />
        </div>
      </section>

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
        <p className="p-6 text-sm text-muted-foreground rounded-xl border border-border bg-card">
          No essays match these filters.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{r.topic}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{r.mode}</span>
                {r.is_submitted && (
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">Submitted</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {names[r.student_id] ?? "Student"} · {countWords(r.content)} words ·{" "}
                {new Date(r.updated_at).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
        <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
};

export default AdminEssays;
