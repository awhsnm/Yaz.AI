import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUBJECTS = ["English", "Russian Literature", "Kazakh Literature", "General"];

const JoinLesson = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [code, setCode] = useState("");
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [classroomName, setClassroomName] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const validateCode = async () => {
    setError("");
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Code must be exactly 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase
      .from("classrooms")
      .select("id, name, is_active")
      .eq("access_code", trimmed)
      .maybeSingle();
    setBusy(false);
    if (err || !data || !data.is_active) {
      setError("Invalid or inactive code. Ask your teacher for the current lesson code.");
      return;
    }
    setClassroomId(data.id);
    setClassroomName(data.name ?? "Lesson");
  };

  const startEssay = async () => {
    if (!user || !classroomId || !topic.trim() || !subject) return;
    setBusy(true);
    const { data, error: err } = await supabase
      .from("essays")
      .insert({ student_id: user.id, topic: topic.trim(), subject, classroom_id: classroomId })
      .select()
      .single();
    setBusy(false);
    if (err || !data) {
      toast({ title: "Could not start", description: err?.message, variant: "destructive" });
      return;
    }
    navigate(`/essay/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student-dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-display font-bold text-foreground">Join a Lesson</h1>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {!classroomId ? (
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
              </div>
              <h2 className="text-center font-display font-bold text-xl text-foreground mb-1">
                Enter Teacher's Access Code
              </h2>
              <p className="text-center text-sm text-muted-foreground font-display mb-6">
                Your teacher will share a 6-character code for this lesson.
              </p>
              <Input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && validateCode()}
                maxLength={6}
                placeholder="ABC123"
                className="text-center text-2xl tracking-[0.5em] font-display font-bold h-14 uppercase"
                autoFocus
              />
              {error && <p className="text-destructive text-sm font-display mt-3 text-center">{error}</p>}
              <Button onClick={validateCode} disabled={busy || code.trim().length !== 6} className="w-full mt-6 font-display">
                Validate Code
              </Button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-success" />
                </div>
              </div>
              <h2 className="text-center font-display font-bold text-xl text-foreground mb-1">
                Joined: {classroomName}
              </h2>
              <p className="text-center text-sm text-muted-foreground font-display mb-6">
                Set your essay topic to begin the 45-minute session.
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="font-display">Topic</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Essay topic" />
                </div>
                <div>
                  <Label className="font-display">Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={startEssay}
                  disabled={busy || !topic.trim() || !subject}
                  className="w-full font-display"
                >
                  Start 45-Minute Session
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinLesson;