import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, BookOpen, LogOut, FileText, CheckCircle2, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Essay {
  id: string;
  topic: string;
  subject: string;
  content: string;
  is_submitted: boolean;
  updated_at: string;
  evaluated?: boolean;
}

const StudentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [essays, setEssays] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("essays")
        .select("id, topic, subject, content, is_submitted, updated_at")
        .eq("student_id", user.id)
        .order("updated_at", { ascending: false });
      const list = data ?? [];
      if (list.length) {
        const { data: evals } = await supabase
          .from("evaluations")
          .select("essay_id")
          .in("essay_id", list.map((e) => e.id));
        const evalSet = new Set((evals ?? []).map((x) => x.essay_id));
        setEssays(list.map((e) => ({ ...e, evaluated: evalSet.has(e.id) })));
      } else {
        setEssays([]);
      }
      setLoading(false);
    })();
  }, [user]);

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
          <Button onClick={() => navigate("/join")}>
            <KeyRound className="w-4 h-4 mr-2" />Join a Lesson
          </Button>
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
                  onClick={() => navigate(e.evaluated ? `/feedback/${e.id}` : `/essay/${e.id}`)}
                  className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-foreground truncate">{e.topic || "Untitled"}</h3>
                      <p className="text-xs text-muted-foreground font-display mt-0.5">{e.subject} • {wc} words</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-display shrink-0">
                      {e.evaluated ? (
                        <span className="flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 font-semibold"><Award className="w-3.5 h-3.5" />Evaluated — View Feedback</span>
                      ) : e.is_submitted ? (
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