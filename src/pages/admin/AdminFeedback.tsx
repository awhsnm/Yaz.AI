import { useCallback, useEffect, useState } from "react";
import { Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logRequestError } from "@/lib/logError";

interface Row {
  id: string;
  category: string;
  message: string;
  page_url: string | null;
  screenshot_path: string | null;
  status: string;
  created_at: string;
}

const PAGE_SIZE = 20;
const STATUSES = ["new", "reviewing", "resolved", "closed"];

const AdminFeedback = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("beta_feedback")
      .select("id,category,message,page_url,screenshot_path,status,created_at")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    if (category !== "all") q = q.eq("category", category);
    if (status !== "all") q = q.eq("status", status);
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) q = q.lte("created_at", new Date(`${to}T23:59:59`).toISOString());

    const { data, error } = await q;
    setLoading(false);
    if (error) {
      logRequestError("admin-feedback", error);
      setFailed(true);
      return;
    }
    setFailed(false);
    const list = (data ?? []) as Row[];
    setHasMore(list.length > PAGE_SIZE);
    setRows(list.slice(0, PAGE_SIZE));
  }, [page, category, status, from, to]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [category, status, from, to]);

  const updateStatus = async (id: string, next: string) => {
    const { error } = await supabase.from("beta_feedback").update({ status: next }).eq("id", id);
    if (error) {
      logRequestError("admin-feedback-status", error);
      toast({ title: "Could not update that item.", variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
  };

  const openShot = async (path: string) => {
    const { data, error } = await supabase.storage.from("feedback-screenshots").createSignedUrl(path, 300);
    if (error || !data) {
      toast({ title: "Screenshot unavailable.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-4">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="confusing">Confusing feature</SelectItem>
              <SelectItem value="suggestion">Suggestion</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="fb-from">From</Label>
          <Input id="fb-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="fb-to">To</Label>
          <Input id="fb-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </section>

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : failed ? (
        <div className="p-6 text-sm text-muted-foreground space-y-3 rounded-xl border border-border bg-card">
          <p>We couldn't load feedback just now.</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground rounded-xl border border-border bg-card">No feedback matches these filters.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5 capitalize text-foreground">{r.category}</span>
                <span>{new Date(r.created_at).toLocaleString()}</span>
                {r.page_url && <span className="font-mono">{r.page_url}</span>}
                <div className="ml-auto w-40">
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{r.message}</p>
              {r.screenshot_path && (
                <Button size="sm" variant="outline" onClick={() => openShot(r.screenshot_path!)}>
                  <ImageIcon className="w-3.5 h-3.5 mr-1" /> View screenshot
                </Button>
              )}
            </article>
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

export default AdminFeedback;
