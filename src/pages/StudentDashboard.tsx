import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, LogOut, FileText, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUBJECTS = ["English", "Russian Literature", "Kazakh Literature", "General"];

interface Essay {
  id: string;
  topic: string;
  subject: string;
  content: string;
  is_submitted: boolean;
  updated_at: string;
}

const StudentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [essays, setEssays] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("essays")
      .select("id, topic, subject, content, is_submitted, updated_at")
      .eq("student_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setEssays(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const startEssay = async () => {
    if (!user || !topic.trim() || !subject) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("essays")
      .insert({ student_id: user.id, topic: topic.trim(), subject })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      toast({ title: "Could not start", description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/essay/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground">My Essays</h1>
              <p className="text-xs text-muted-foreground font-display">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 mr-2" />Sign out</Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-semibold text-foreground">Drafts & Submissions</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Start New Essay</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Essay</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Topic</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Themes of identity in modern literature" />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={startEssay} disabled={busy || !topic.trim() || !subject}>Begin</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground font-display">Loading...</p>
        ) : essays.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-display">No essays yet. Start your first draft.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {essays.map((e) => {
              const wc = e.content.trim().split(/\s+/).filter(Boolean).length;
              return (
                <button
                  key={e.id}
                  onClick={() => navigate(`/essay/${e.id}`)}
                  className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-foreground truncate">{e.topic || "Untitled"}</h3>
                      <p className="text-xs text-muted-foreground font-display mt-0.5">{e.subject} • {wc} words</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-display shrink-0">
                      {e.is_submitted ? (
                        <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3.5 h-3.5" />Submitted</span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5" />Draft</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;