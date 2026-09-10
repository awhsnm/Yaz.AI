import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logRequestError } from "@/lib/logError";

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  invited_at: string;
  last_login_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  invited: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  disabled: "bg-destructive/10 text-destructive",
};

const AdminUsers = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [bulk, setBulk] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("beta_allowlist")
      .select("id,email,full_name,role,status,invited_at,last_login_at")
      .order("invited_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      logRequestError("admin-allowlist", error);
      setFailed(true);
      return;
    }
    setFailed(false);
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q) || (r.full_name ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setBusy(true);
    const { error } = await supabase
      .from("beta_allowlist")
      .insert({ email: value, full_name: name.trim() || null, role: role as "student" | "teacher" });
    setBusy(false);
    if (error) {
      logRequestError("admin-invite", error);
      toast({ title: /duplicate/i.test(error.message) ? "That email is already invited." : "Could not add that person.", variant: "destructive" });
      return;
    }
    setEmail(""); setName("");
    toast({ title: "Invited" });
    void load();
  };

  const inviteBulk = async () => {
    const emails = Array.from(
      new Set(
        bulk
          .split(/[\s,;]+/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
      ),
    );
    if (!emails.length) {
      toast({ title: "No valid emails found.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data: existing, error: readError } = await supabase
      .from("beta_allowlist")
      .select("email")
      .in("email", emails);
    if (readError) {
      setBusy(false);
      logRequestError("admin-invite-bulk-read", readError);
      toast({ title: "Some entries could not be added.", variant: "destructive" });
      void load();
      return;
    }
    const known = new Set((existing ?? []).map((r) => r.email.toLowerCase()));
    const fresh = emails.filter((e) => !known.has(e));
    if (fresh.length === 0) {
      setBusy(false);
      toast({ title: "Everyone on that list is already invited." });
      setBulk("");
      void load();
      return;
    }
    const { error } = await supabase
      .from("beta_allowlist")
      .insert(fresh.map((e) => ({ email: e, role: "student" as const })));
    setBusy(false);
    if (error) {
      logRequestError("admin-invite-bulk", error);
      toast({ title: "Some entries could not be added.", variant: "destructive" });
    } else {
      const skipped = emails.length - fresh.length;
      toast({ title: `${fresh.length} added${skipped ? `, ${skipped} already invited` : ""}` });
      setBulk("");
    }
    void load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("beta_allowlist").update({ status }).eq("id", id);
    if (error) {
      logRequestError("admin-status", error);
      toast({ title: "Could not update that person.", variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("beta_allowlist").delete().eq("id", id);
    if (error) {
      logRequestError("admin-remove", error);
      toast({ title: "Could not remove that person.", variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <form onSubmit={invite} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Invite a tester</h2>
          <div>
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inv-name">Full name (optional)</Label>
            <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add to allowlist
          </Button>
        </form>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Bulk invite</h2>
          <Textarea
            rows={6}
            placeholder="Paste up to 28 emails, separated by commas, spaces or new lines"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <Button variant="outline" onClick={inviteBulk} disabled={busy} className="w-full">
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Add all
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="p-4 flex items-center gap-3 flex-wrap border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Invited testers {rows.length > 0 && <span className="text-muted-foreground font-normal">({rows.length})</span>}
          </h2>
          <Input
            className="ml-auto max-w-xs"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        ) : failed ? (
          <div className="p-6 text-sm text-muted-foreground space-y-3">
            <p>We couldn't load the list just now.</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No testers yet. Add the first one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Role</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Last sign-in</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-foreground">{r.email}</td>
                    <td className="p-3 text-muted-foreground">{r.full_name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground capitalize">{r.role}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status] ?? ""}`}>{r.status}</span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.last_login_at ? new Date(r.last_login_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {r.status === "disabled" ? (
                        <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "active")}>
                          <UserCheck className="w-3.5 h-3.5 mr-1" /> Enable
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "disabled")}>
                          <UserX className="w-3.5 h-3.5 mr-1" /> Disable
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="ml-1 text-destructive" onClick={() => remove(r.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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

export default AdminUsers;
