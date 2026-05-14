import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, LogOut, Search, FileText, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface EssayRow {
  id: string;
  topic: string;
  subject: string;
  content: string;
  is_submitted: boolean;
  updated_at: string;
  student_id: string;
  student_name: string | null;
}

const TeacherDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<EssayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: essays } = await supabase
        .from("essays")
        .select("id, topic, subject, content, is_submitted, updated_at, student_id")
        .order("updated_at", { ascending: false });
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      const map = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      setRows(
        (essays ?? []).map((e) => ({ ...e, student_name: map.get(e.student_id) ?? null }))
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.topic.toLowerCase().includes(t) ||
        r.subject.toLowerCase().includes(t) ||
        (r.student_name ?? "").toLowerCase().includes(t)
    );
  }, [rows, q]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground">Teacher Dashboard</h1>
              <p className="text-xs text-muted-foreground font-display">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 mr-2" />Sign out</Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by student, topic, subject..."
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground font-display">
            {filtered.length} of {rows.length}
          </span>
        </div>

        {loading ? (
          <p className="text-muted-foreground font-display">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-display">No essays found.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => {
              const wc = r.content.trim().split(/\s+/).filter(Boolean).length;
              return (
                <button
                  key={r.id}
                  onClick={() => navigate(`/review/${r.id}`)}
                  className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display font-semibold text-foreground truncate">
                          {r.student_name ?? "Unknown student"}
                        </h3>
                        <Badge variant="outline" className="font-display text-xs">{r.subject}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-display truncate">{r.topic || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground font-display mt-1">{wc} words</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-display shrink-0">
                      {r.is_submitted ? (
                        <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3.5 h-3.5" />Submitted</span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5" />In progress</span>
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

export default TeacherDashboard;