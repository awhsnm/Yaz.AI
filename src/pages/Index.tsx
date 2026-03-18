import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, BookOpen, Shield, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-2xl"
      >
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold font-display text-foreground tracking-tight">
            FocusWrite AI
          </h1>
        </div>

        <p className="text-muted-foreground text-lg mb-2 font-display">
          Secure Essay Learning Platform
        </p>
        <p className="text-secondary text-sm mb-10 font-display">
          AI-guided writing in a distraction-free environment
        </p>

        <div className="grid grid-cols-3 gap-4 mb-12 text-left">
          <FeatureCard
            icon={<Shield className="w-5 h-5 text-primary" />}
            title="Secure Focus"
            desc="Locked environment prevents distractions"
          />
          <FeatureCard
            icon={<Brain className="w-5 h-5 text-primary" />}
            title="AI Tutor"
            desc="Guides thinking, never writes for you"
          />
          <FeatureCard
            icon={<GraduationCap className="w-5 h-5 text-primary" />}
            title="Live Tracking"
            desc="Teachers monitor progress in real-time"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/student-entry")}
            className="font-display text-base px-8"
          >
            <GraduationCap className="w-5 h-5 mr-2" />
            I'm a Student
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/teacher")}
            className="font-display text-base px-8"
          >
            <BookOpen className="w-5 h-5 mr-2" />
            I'm a Teacher
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const FeatureCard = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="mb-2">{icon}</div>
    <h3 className="font-display font-semibold text-sm text-foreground mb-1">{title}</h3>
    <p className="text-muted-foreground text-xs">{desc}</p>
  </div>
);

export default Index;
