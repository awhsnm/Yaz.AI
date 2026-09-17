import { useState } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logRequestError } from "@/lib/logError";

interface ResultRow {
  email: string;
  password: string | null;
  participant_code: string | null;
  status: "created" | "updated" | "skipped";
  note?: string;
}

const STATUS_STYLE: Record<string, string> = {
  created: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  updated: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  skipped: "bg-destructive/10 text-destructive",
};

const AdminRosterInvite = () => {
  const { toast } = useToast();
  const [emails, setEmails] = useState("");
  const [password, setPassword] = useState("FocusWrite2026!");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("provision-students", {
      body: { emails, password, role },
    });
    setBusy(false);
    if (fnError || data?.error) {
      const message = data?.error ?? fnError?.message ?? "Something went wrong.";
      logRequestError("provision-students", fnError ?? new Error(message));
      setError(String(message));
      return;
    }
    const results = (data?.results ?? []) as ResultRow[];
    setRows(results);
    toast({ title: `${results.filter((r) => r.status !== "skipped").length} account(s) ready` });
  };

  const copyTable = async () => {
    const text = [
      "Email\tTemporary password\tCode",
      ...rows
        .filter((r) => r.password)
        .map((r) => `${r.email}\t${r.password}\t${r.participant_code ?? "—"}`),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Create student accounts</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Accounts are created ready to use — students sign in straight away with the password below. No confirmation
            email is sent.
          </p>
        </div>

        <div>
          <Label htmlFor="roster-emails">Email addresses</Label>
          <Textarea
            id="roster-emails"
            rows={7}
            placeholder="Paste emails separated by commas, spaces or new lines"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="roster-pw">Temporary password</Label>
            <Input id="roster-pw" value={password} onChange={(e) => setPassword(e.target.value)} />
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
        </div>

        <Button onClick={() => void run()} disabled={busy || !emails.trim()}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
          Create accounts
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {rows.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <div className="p-4 flex items-center gap-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Login details ({rows.length})</h2>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => void copyTable()}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Copy table
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Temporary password</th>
                  <th className="p-3 font-medium">Code</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email} className="border-b border-border last:border-0">
                    <td className="p-3 text-foreground">{r.email}</td>
                    <td className="p-3 font-mono text-xs text-foreground">{r.password ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.participant_code ?? "—"}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                      {r.note && <span className="ml-2 text-xs text-muted-foreground">{r.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminRosterInvite;
