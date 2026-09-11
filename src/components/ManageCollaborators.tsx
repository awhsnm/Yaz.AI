import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Collaborator {
  id: string;
  assignment_id: string;
  invited_email: string;
  collaborator_user_id: string | null;
  role: string;
  status: "pending" | "accepted" | "revoked";
  invited_at: string;
  accepted_at: string | null;
}

export const useCollaborators = (assignmentIds: string[]) => {
  const [map, setMap] = useState<Record<string, Collaborator[]>>({});

  const reload = useCallback(async () => {
    if (assignmentIds.length === 0) return;
    const { data } = await supabase
      .from("assignment_collaborators")
      .select("*")
      .in("assignment_id", assignmentIds);
    const next: Record<string, Collaborator[]> = {};
    for (const row of (data ?? []) as Collaborator[]) {
      (next[row.assignment_id] ??= []).push(row);
    }
    setMap(next);
  }, [assignmentIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void reload(); }, [reload]);
  return { map, reload };
};

export const SharedBadge = ({ collaborators }: { collaborators?: Collaborator[] }) => {
  const accepted = (collaborators ?? []).filter((c) => c.status === "accepted").length;
  if (accepted === 0) {
    return <span className="text-xs font-display text-muted-foreground">Private assignment</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <Badge className="font-display text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
        <span className="mr-1">🟢</span>Shared
      </Badge>
      <span className="text-xs font-display text-muted-foreground">
        Shared with {accepted} collaborator{accepted === 1 ? "" : "s"}
      </span>
    </span>
  );
};

interface Props {
  assignmentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

const ManageCollaborators = ({ assignmentId, open, onOpenChange, onChanged }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Collaborator[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("reviewer");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("assignment_collaborators")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("invited_at", { ascending: false });
    const list = (data ?? []) as Collaborator[];
    setRows(list);
    const ids = list.map((r) => r.collaborator_user_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? ""])));
    }
    setLoading(false);
  }, [assignmentId]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const invite = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !user) return;
    setBusy(true);
    const { error } = await supabase.from("assignment_collaborators").insert({
      assignment_id: assignmentId,
      invited_email: clean,
      role,
      invited_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast({
        title: "Could not send invitation",
        description: error.message.includes("duplicate")
          ? "This email has already been invited to this assignment."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    setEmail("");
    toast({
      title: "Invitation created",
      description: "The collaborator must sign in with the invited email address to receive access.",
    });
    await load();
    onChanged?.();
  };

  const revoke = async (row: Collaborator) => {
    const { error } = await supabase
      .from("assignment_collaborators")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Could not revoke access", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    onChanged?.();
  };

  const accepted = rows.filter((r) => r.status === "accepted");
  const pending = rows.filter((r) => r.status === "pending");
  const revoked = rows.filter((r) => r.status === "revoked");

  const Row = ({ r }: { r: Collaborator }) => (
    <div className="border border-border rounded-lg p-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {r.collaborator_user_id && names[r.collaborator_user_id] && (
          <p className="font-display font-semibold text-foreground truncate">{names[r.collaborator_user_id]}</p>
        )}
        <p className="text-sm font-display text-foreground truncate">{r.invited_email}</p>
        <p className="text-xs font-display text-muted-foreground capitalize">
          {r.role} · {r.status}
        </p>
        <p className="text-xs font-display text-muted-foreground">
          Invited {new Date(r.invited_at).toLocaleDateString()}
          {r.accepted_at ? ` · Accepted ${new Date(r.accepted_at).toLocaleDateString()}` : ""}
        </p>
        {r.status === "accepted" && (
          <p className="text-xs font-display text-muted-foreground mt-1">
            Access: Student essays, AI assessment briefs, annotations, Writing Playback
          </p>
        )}
      </div>
      {r.status !== "revoked" && (
        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => revoke(r)}>
          {r.status === "accepted" ? "Remove access" : "Revoke invitation"}
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage collaborators</DialogTitle>
          <DialogDescription>
            Invite a reviewer to access this assignment and its student essays.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Collaborator email address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@example.com"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reviewer">Reviewer</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs font-display text-muted-foreground mt-1">
              Reviewers can view student essays, AI assessment briefs, feedback, annotations, and Writing
              Playback. They cannot change assignment settings or manage access.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {loading ? (
            <p className="text-sm font-display text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />Loading…
            </p>
          ) : (
            <>
              {accepted.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-display font-semibold text-sm text-foreground">Collaborators</h4>
                  {accepted.map((r) => <Row key={r.id} r={r} />)}
                </div>
              )}
              {pending.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-display font-semibold text-sm text-foreground">Pending invitations</h4>
                  {pending.map((r) => <Row key={r.id} r={r} />)}
                </div>
              )}
              {revoked.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-display font-semibold text-sm text-foreground">Revoked</h4>
                  {revoked.map((r) => <Row key={r.id} r={r} />)}
                </div>
              )}
              {rows.length === 0 && (
                <p className="text-sm font-display text-muted-foreground">No collaborators yet.</p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={invite} disabled={busy || !email.trim()}>
            <UserPlus className="w-4 h-4 mr-2" />Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageCollaborators;
