import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, MonitorSmartphone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

function describeClient() {
  const ua = navigator.userAgent;
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Unknown browser";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /(iPhone|iPad|iOS)/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown OS";
  return { browser, os };
}

const SecuritySettings = () => {
  const { user, session, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const client = useMemo(describeClient, []);
  const lastActive = session?.user?.last_sign_in_at
    ? new Date(session.user.last_sign_in_at).toLocaleString()
    : "—";

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (newPassword.length < 8) {
      return toast({ title: "New password must be at least 8 characters.", variant: "destructive" });
    }
    if (newPassword !== confirmPassword) {
      return toast({ title: "New passwords do not match.", variant: "destructive" });
    }
    setBusy(true);
    const { error: reauth } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauth) {
      setBusy(false);
      return toast({ title: "Current password is incorrect.", variant: "destructive" });
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) return toast({ title: "Could not update password", description: error.message, variant: "destructive" });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "Password updated." });
  };

  const signOutOthers = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    if (error) return toast({ title: "Could not sign out other devices", description: error.message, variant: "destructive" });
    toast({ title: "Signed out of all other devices." });
  };

  const deleteAccount = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: confirmText.trim() },
    });
    setBusy(false);
    if (error || (data && (data as { error?: string }).error)) {
      return toast({
        title: "Could not delete account",
        description: error?.message ?? (data as { error?: string })?.error,
        variant: "destructive",
      });
    }
    toast({ title: "Account deleted." });
    await signOut();
  };

  const confirmValid =
    confirmText.trim() === "DELETE" ||
    confirmText.trim().toLowerCase() === (user?.email ?? "").toLowerCase();

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate(role === "teacher" ? "/teacher-dashboard" : "/student-dashboard")}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </button>

        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Security settings</h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
        </div>

        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold font-display text-foreground flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-primary" /> Change password
          </h2>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <Label htmlFor="cur-pw">Current password</Label>
              <Input id="cur-pw" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-pw">New password</Label>
              <Input id="new-pw" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="conf-pw">Confirm new password</Label>
              <Input id="conf-pw" type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>Update password</Button>
          </form>
        </section>

        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold font-display text-foreground flex items-center gap-2 mb-3">
            <MonitorSmartphone className="w-4 h-4 text-primary" /> Active session
          </h2>
          <dl className="text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between"><dt>Browser</dt><dd className="text-foreground">{client.browser}</dd></div>
            <div className="flex justify-between"><dt>Operating system</dt><dd className="text-foreground">{client.os}</dd></div>
            <div className="flex justify-between"><dt>Last active</dt><dd className="text-foreground">{lastActive}</dd></div>
          </dl>
          <Button variant="outline" className="mt-4" onClick={signOutOthers} disabled={busy}>
            Log out of all other devices
          </Button>
        </section>

        <section className="border-2 border-destructive/60 rounded-xl p-5 bg-destructive/5">
          <h2 className="text-sm font-semibold font-display text-destructive flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4" /> Danger zone
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Deleting your account permanently removes your profile, essays, drafts and feedback. This cannot be undone.
          </p>
          <Button variant="destructive" className="mt-4" onClick={() => setDeleteOpen(true)}>Delete account</Button>
        </section>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">Delete account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Type <span className="font-semibold text-foreground">DELETE</span> or your email address{" "}
            <span className="font-semibold text-foreground">{user?.email}</span> to confirm.
          </p>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
          <Button variant="destructive" disabled={!confirmValid || busy} onClick={deleteAccount}>
            Permanently delete my account
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default SecuritySettings;
