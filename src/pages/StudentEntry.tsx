import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const StudentEntry = () => {
  const [password, setPassword] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleEntry = () => {
    // Demo: any 6+ char password works
    if (!studentName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (password.length < 4) {
      setError("Invalid session password");
      return;
    }
    sessionStorage.setItem("focuswrite_student", studentName.trim());
    sessionStorage.setItem("focuswrite_session", password);
    navigate("/workspace");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary" />
            </div>
          </div>

          <h1 className="text-xl font-bold font-display text-foreground text-center mb-1">
            Enter Session
          </h1>
          <p className="text-muted-foreground text-sm text-center mb-6 font-display">
            Enter the password provided by your teacher
          </p>

          <div className="space-y-3 mb-4">
            <Input
              placeholder="Your full name"
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); setError(""); }}
              className="font-display"
            />
            <Input
              type="password"
              placeholder="Session password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleEntry()}
              className="font-display"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm mb-3 font-display">{error}</p>
          )}

          <Button onClick={handleEntry} className="w-full font-display" size="lg">
            <BookOpen className="w-4 h-4 mr-2" />
            Enter Focus Mode
          </Button>

          <div className="mt-5 bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground font-display">
              Once you enter, close all other tabs and applications. Your writing session will be monitored.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StudentEntry;
