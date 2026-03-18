import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, LogOut, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import AITutorSidebar from "@/components/AITutorSidebar";
import ExitModal from "@/components/ExitModal";

const StudentWorkspace = () => {
  const [essay, setEssay] = useState("");
  const [showExit, setShowExit] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const navigate = useNavigate();

  const studentName = sessionStorage.getItem("focuswrite_student");

  useEffect(() => {
    if (!studentName) {
      navigate("/student-entry");
      return;
    }
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [studentName, navigate]);

  const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!studentName) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="h-11 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-xs font-display font-medium text-success">Focus Mode Active</span>
          </div>
          <span className="text-xs text-muted-foreground font-display">|</span>
          <span className="text-xs text-muted-foreground font-display">{studentName}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-display">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(elapsed)}
          </div>
          <span className="text-xs text-muted-foreground font-display">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExit(true)}
            className="font-display text-xs h-7"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Request Exit
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Writing area - 70% */}
        <div className="flex-[7] flex justify-center overflow-y-auto p-8">
          <div className="w-full max-w-[800px]">
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="Begin writing your essay here...&#10;&#10;Take a deep breath. Organize your thoughts. Start with your main argument."
              className="w-full h-full min-h-[calc(100vh-8rem)] resize-none bg-transparent focus-editor outline-none placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>
        </div>

        {/* AI Tutor - 30% */}
        <div className="flex-[3] min-w-[300px] max-w-[400px]">
          <AITutorSidebar />
        </div>
      </div>

      <ExitModal open={showExit} onClose={() => setShowExit(false)} essayContent={essay} />
    </div>
  );
};

export default StudentWorkspace;
