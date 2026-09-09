import { useCallback, useEffect, useState } from "react";
import { Loader2, Users, LogIn, MessageSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logRequestError } from "@/lib/logError";

interface ErrRow {
  id: string;
  created_at: string;
  page: string | null;
  feature: string | null;
  message: string;
  severity: string;
  user_id: string | null;
}

const AdminHealth = () => {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const [loginsToday, setLoginsToday] = useState(0);
  const [daily, setDaily] = useState<{ day: string; count: number }[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [openFeedback, setOpenFeedback] = useState(0);
  const [errors, setErrors] = useState<ErrRow[]>([]);
  const [failedRequests, setFailedRequests] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

    const [active, logins, todayLogins, fb, fbOpen, errs, reqs] = await Promise.all([
      supabase.from("beta_allowlist").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("login_events").select("created_at").gte("created_at", since).limit(2000),
      supabase.from("login_events").select("id", { count: "exact", head: true }).gte("created_at", startOfDay.toISOString()),
      supabase.from("beta_feedback").select("id", { count: "exact", head: true }),
      supabase.from("beta_feedback").select("id", { count: "exact", head: true }).in("status", ["new", "reviewing"]),
      supabase.from("error_logs").select("id,created_at,page,feature,message,severity,user_id")
        .neq("severity", "request").order("created_at", { ascending: false }).limit(25),
      supabase.from("error_logs").select("id", { count: "exact", head: true })
        .eq("severity", "request").gte("created_at", since),
    ]);

    setLoading(false);
    const anyError = [active, logins, todayLogins, fb, fbOpen, errs, reqs].find((r) => r.error);
    if (anyError?.error) {
      logRequestError("admin-health", anyError.error);
      setFailed(true);
      return;
    }
    setFailed(false);

    setActiveUsers(active.count ?? 0);
    setLoginsToday(todayLogins.count ?? 0);
    setFeedbackCount(fb.count ?? 0);
    setOpenFeedback(fbOpen.count ?? 0);
    setErrors((errs.data ?? []) as ErrRow[]);
    setFailedRequests(reqs.count ?? 0);

    const buckets = new Map<string, number>();
    for (const row of (logins.data ?? []) as { created_at: string }[]) {
      const day = row.created_at.slice(0, 10);
      buckets.set(day, (buckets.get(day) ?? 0) + 1);
    }
    setDaily(Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  }
  if (failed) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card text-sm text-muted-foreground space-y-3">
        <p>We couldn't load the health data just now.</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
      </div>
    );
  }

  const max = Math.max(1, ...daily.map((d) => d.count));

  const stats = [
    { label: "Active beta users", value: activeUsers, icon: Users },
    { label: "Logins today", value: loginsToday, icon: LogIn },
    { label: "Feedback (open)", value: `${feedbackCount} (${openFeedback})`, icon: MessageSquare },
    { label: "Failed requests, 14d", value: failedRequests, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <s.icon className="w-4 h-4" /> {s.label}
            </div>
            <p className="mt-2 text-2xl font-semibold font-display text-foreground">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Daily logins (last 14 days)</h2>
        {daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-ins recorded yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {daily.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
                <div className="w-full rounded-t bg-primary/70" style={{ height: `${(d.count / max) * 100}%` }} />
                <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card">
        <h2 className="text-sm font-semibold text-foreground p-4 border-b border-border">Recent errors</h2>
        {errors.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No errors recorded. </p>
        ) : (
          <ul className="divide-y divide-border">
            {errors.map((e) => (
              <li key={e.id} className="p-4 text-sm">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 capitalize">{e.severity}</span>
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                  {e.page && <span className="font-mono">{e.page}</span>}
                  {e.feature && <span>· {e.feature}</span>}
                </div>
                <p className="mt-1 text-foreground break-words">{e.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AdminHealth;
