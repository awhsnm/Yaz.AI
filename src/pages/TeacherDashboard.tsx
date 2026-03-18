import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Copy,
  RefreshCw,
  Users,
  AlertTriangle,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface StudentCard {
  id: string;
  name: string;
  wordCount: number;
  timeElapsed: string;
  status: "writing" | "idle" | "struggling";
  aiSummary: string;
  activityData: number[];
}

const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const mockStudents: StudentCard[] = [
  {
    id: "1", name: "Anna K.", wordCount: 342, timeElapsed: "18:32",
    status: "writing", aiSummary: "Good progress on structure",
    activityData: [2, 5, 8, 12, 15, 18, 22, 28, 34],
  },
  {
    id: "2", name: "Bekzat T.", wordCount: 89, timeElapsed: "18:32",
    status: "struggling", aiSummary: "Struggling with introduction — asked AI 4 times about starting",
    activityData: [1, 2, 2, 3, 3, 4, 5, 7, 9],
  },
  {
    id: "3", name: "Daria M.", wordCount: 521, timeElapsed: "18:32",
    status: "writing", aiSummary: "Strong argumentation, working on conclusion",
    activityData: [5, 10, 18, 25, 32, 38, 42, 48, 52],
  },
  {
    id: "4", name: "Samat A.", wordCount: 12, timeElapsed: "18:32",
    status: "idle", aiSummary: "Minimal activity — may need direct encouragement",
    activityData: [0, 0, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: "5", name: "Lena P.", wordCount: 267, timeElapsed: "18:32",
    status: "writing", aiSummary: "Working on paragraph transitions",
    activityData: [3, 6, 10, 14, 17, 20, 23, 25, 27],
  },
  {
    id: "6", name: "Arman B.", wordCount: 156, timeElapsed: "18:32",
    status: "struggling", aiSummary: "Struggling with logical flow between arguments",
    activityData: [2, 4, 5, 7, 9, 10, 12, 14, 16],
  },
];

const TeacherDashboard = () => {
  const [entryPassword, setEntryPassword] = useState(generatePassword());
  const [exitPassword, setExitPassword] = useState(generatePassword());
  const navigate = useNavigate();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "writing": return "bg-success/10 text-success border-success/20";
      case "struggling": return "bg-warning/10 text-warning border-warning/20";
      case "idle": return "bg-muted text-muted-foreground border-border";
      default: return "";
    }
  };

  const MiniSparkline = ({ data }: { data: number[] }) => {
    const max = Math.max(...data, 1);
    const h = 24;
    const w = 80;
    const step = w / (data.length - 1);
    const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
    return (
      <svg width={w} height={h} className="shrink-0">
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const struggling = mockStudents.filter((s) => s.status === "struggling").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="mr-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground text-lg">Teacher Dashboard</h1>
              <p className="text-xs text-muted-foreground font-display">Session in progress</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-display">
              <Users className="w-4 h-4" />
              {mockStudents.length} students
            </div>
            {struggling > 0 && (
              <Badge variant="outline" className={`font-display ${statusColor("struggling")}`}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                {struggling} need help
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Session passwords */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <PasswordCard
            label="Entry Password"
            description="Share with students to join the session"
            password={entryPassword}
            onCopy={() => copyToClipboard(entryPassword, "Entry password")}
            onRegenerate={() => setEntryPassword(generatePassword())}
          />
          <PasswordCard
            label="Exit Password"
            description="Share at the end to let students submit"
            password={exitPassword}
            onCopy={() => copyToClipboard(exitPassword, "Exit password")}
            onRegenerate={() => setExitPassword(generatePassword())}
          />
        </div>

        {/* Student grid */}
        <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Student Progress
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockStudents.map((student) => (
            <div
              key={student.id}
              className="bg-card border border-border rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display font-semibold text-foreground text-sm">
                    {student.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-display">{student.timeElapsed}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs font-display capitalize ${statusColor(student.status)}`}
                >
                  {student.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-display font-bold text-foreground">
                  {student.wordCount}
                </span>
                <MiniSparkline data={student.activityData} />
              </div>

              <div
                className={`text-xs font-display rounded-md px-2.5 py-2 ${
                  student.status === "struggling"
                    ? "bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {student.status === "struggling" && (
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                )}
                {student.aiSummary}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PasswordCard = ({
  label,
  description,
  password,
  onCopy,
  onRegenerate,
}: {
  label: string;
  description: string;
  password: string;
  onCopy: () => void;
  onRegenerate: () => void;
}) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <div>
        <h3 className="font-display font-semibold text-sm text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground font-display">{description}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-muted px-3 py-2 rounded-md text-lg font-mono font-bold text-foreground tracking-widest text-center">
        {password}
      </code>
      <Button variant="outline" size="icon" onClick={onCopy} title="Copy">
        <Copy className="w-4 h-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onRegenerate} title="Regenerate">
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

export default TeacherDashboard;
