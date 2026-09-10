import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, FileText, CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logRequestError } from "@/lib/logError";

interface ProgressRow {
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  invited_at: string;
  last_login_at: string | null;
  signed_up: boolean;
  essay_count: number;
  submitted_count: number;
  feedback_count: number;
}

const TARGET = 28;

const STATUS_STYLES: Record<string, string> = {
  invited: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  disabled: "bg-destructive/10 text-destructive",
};

const AdminProgress = () => {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("beta_progress");
    setLoading(false);
    if (error) {
      logRequestError("admin-progress", error);
      setFailed(true);
      return;
    }
    setFailed(false);
    setRows((data ?? []) as ProgressRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q) || (r.full_name ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => {
    const signedUp = rows.filter((r) => r.signed_up).length;
    const wrote = rows.filter((r) => r.essay_count > 0).length;
    const submitted = rows.filter((r) => r.submitted_count > 0).length;
    const gaveFeedback = rows.filter((r) => r.feedback_count > 0).length;
    return [
      { label: "Signed up", value: signedUp, icon: UserPlus },
      { label: "Wrote an essay", value: wrote, icon: FileText },
      { label: "Submitted an essay", value: submitted, icon: CheckCircle2 },
      { label: "Sent feedback", value: gaveFeedback, icon: MessageSquare },
    ];
  }, [rows]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  }
  if (failed) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card text-sm text-muted-foreground space-y-3">
        <p>We couldn't load tester progress just now.</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
      </div>
    );
  }

  const denominator = Math.max(TARGET, rows.length);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <s.icon className="w-4 h-4" /> {s.label}
            </div>
            <p className="mt-2 text-2xl font-semibold font-display text-foreground">
              {s.value} <span className="text-sm font-normal text-muted-foreground">of {denominator}</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(s.value / denominator) * 100}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">Per-tester progress</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="ml-auto w-full sm:w-64"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No invited testers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="p-3 font-medium">Tester</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Signed up</th>
                  <th className="p-3 font-medium">Essays</th>
                  <th className="p-3 font-medium">Submitted</th>
                  <th className="p-3 font-medium">Feedback</th>
                  <th className="p-3 font-medium">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.email}>
                    <td className="p-3">
                      <p className="text-foreground">{r.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono break-all">{r.email}</p>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status] ?? "bg-muted"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3">{r.signed_up ? "Yes" : "Not yet"}</td>
                    <td className="p-3">{r.essay_count}</td>
                    <td className="p-3">{r.submitted_count}</td>
                    <td className="p-3">{r.feedback_count}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {r.last_login_at ? new Date(r.last_login_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminProgress;
