import { useEffect, useState } from "react";
import { MessageSquarePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logRequestError } from "@/lib/logError";

const CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "confusing", label: "Confusing feature" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
];

const FEEDBACK_DISMISSED_KEY = "yaz-feedback-dismissed";

const FeedbackButton = () => {
  const { user, betaStatus } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(FEEDBACK_DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    try {
      sessionStorage.setItem(FEEDBACK_DISMISSED_KEY, "1");
    } catch {
      // ignore storage errors
    }
  };

  if (!user || betaStatus !== "active") return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);

    let screenshotPath: string | null = null;
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setBusy(false);
        toast({ title: "Screenshot must be under 5 MB", variant: "destructive" });
        return;
      }
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("feedback-screenshots").upload(path, file);
      if (error) {
        logRequestError("feedback-upload", error);
      } else {
        screenshotPath = path;
      }
    }

    const { error } = await supabase.from("beta_feedback").insert({
      user_id: user.id,
      category,
      message: message.trim().slice(0, 5000),
      page_url: window.location.pathname + window.location.search,
      screenshot_path: screenshotPath,
      user_agent: navigator.userAgent.slice(0, 400),
    });
    setBusy(false);

    if (error) {
      logRequestError("feedback-insert", error);
      toast({
        title: /Too many/i.test(error.message)
          ? "Please wait a few minutes before sending more feedback."
          : "We couldn't send that just now. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Thanks — your feedback was sent." });
    setMessage("");
    setFile(null);
    setCategory("bug");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <MessageSquarePlus className="w-4 h-4" />
        Send Feedback
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fb-msg">What happened?</Label>
              <Textarea
                id="fb-msg"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the problem or idea…"
              />
            </div>
            <div>
              <Label htmlFor="fb-shot">Screenshot (optional)</Label>
              <Input
                id="fb-shot"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The page you are on and the time are attached automatically.
            </p>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {busy ? "Sending…" : "Send feedback"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeedbackButton;
