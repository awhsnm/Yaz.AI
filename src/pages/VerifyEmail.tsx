import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailCheck, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const COOLDOWN = 60;

const VerifyEmail = () => {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  const pendingEmail = user?.email ?? sessionStorage.getItem("pendingVerifyEmail") ?? "";

  useEffect(() => {
    if (!loading && user?.email_confirmed_at) {
      navigate(role === "teacher" ? "/teacher-dashboard" : "/student-dashboard", { replace: true });
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const resend = async () => {
    if (!pendingEmail || cooldown > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/student-dashboard` },
    });
    setBusy(false);
    setCooldown(COOLDOWN);
    if (error) {
      toast({ title: "Could not resend", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Verification email sent", description: `Check ${pendingEmail}.` });
    }
  };

  const refresh = async () => {
    setBusy(true);
    const { data } = await supabase.auth.refreshSession();
    setBusy(false);
    if (data.user?.email_confirmed_at) {
      window.location.replace("/student-dashboard");
    } else {
      toast({ title: "Still unverified", description: "Click the link in your email, then try again." });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <MailCheck className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold font-display text-foreground">Verify your email</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">{pendingEmail || "your email"}</span>. Please verify to
          activate your account.
        </p>

        <div className="mt-5 space-y-2">
          <Button className="w-full" onClick={resend} disabled={busy || cooldown > 0 || !pendingEmail}>
            {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification email"}
          </Button>
          <Button variant="outline" className="w-full" onClick={refresh} disabled={busy || !user}>
            <RefreshCw className="w-4 h-4 mr-2" />
            I've verified — continue
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={user ? signOut : () => navigate("/auth")}>
            <LogOut className="w-4 h-4 mr-2" />
            Back to sign in
          </Button>
        </div>
      </div>
    </main>
  );
};

export default VerifyEmail;
