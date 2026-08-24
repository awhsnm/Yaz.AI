import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hidden, invitation-only research pilot entry point (/research-pilot).
 * Not linked from the homepage, navigation, footer, or any public surface.
 * The invite code is validated server-side; it never exists in client source.
 */
const ResearchPilot = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep this page out of search engines and crawlers.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = "Research pilot";
    return () => {
      document.head.removeChild(meta);
      document.title = prevTitle;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("research-invite", {
      body: { code: code.trim() },
    });
    setBusy(false);

    const essayId = (data as { essay_id?: string } | null)?.essay_id;
    if (fnError || !essayId) {
      setError("That invite code is not valid. Check the code you were given and try again.");
      return;
    }
    // Consent is enforced inside the writing session before any input is possible.
    navigate(`/essay/${essayId}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <FlaskConical className="w-4 h-4 text-primary" />
            <h1 className="font-display text-base font-semibold text-foreground">Research pilot access</h1>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label htmlFor="invite" className="block font-display text-sm text-muted-foreground">
              Enter your invite code to begin.
            </label>
            <Input
              id="invite"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              placeholder="Invite code"
              className="font-display tracking-wide"
            />
            {error && <p className="font-display text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={busy || !code.trim()} className="w-full font-display">
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
              Begin pilot session
            </Button>
          </form>

          <p className="mt-6 pt-4 border-t border-border font-display text-[11px] leading-relaxed text-muted-foreground">
            This invitation-only pilot records pseudonymised writing and interaction data for research purposes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResearchPilot;
