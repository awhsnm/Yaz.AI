import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface ExitModalProps {
  open: boolean;
  onClose: () => void;
  essayContent: string;
  essayId?: string;
}

const ExitModal = ({ open, onClose, essayContent, essayId }: ExitModalProps) => {
  const [exitPassword, setExitPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleExit = async () => {
    // Demo: any 4+ char password works as exit password
    if (exitPassword.length < 4) {
      setError("Invalid exit password. Ask your teacher.");
      return;
    }
    if (essayId) {
      await supabase.from("essays").update({ is_submitted: true, content: essayContent }).eq("id", essayId);
    }
    navigate("/student-dashboard");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center font-display">Submit & Exit</DialogTitle>
          <DialogDescription className="text-center font-display">
            Enter the exit password provided by your teacher to submit your essay and leave the session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground font-display">
              Word count: <span className="font-semibold text-foreground">{essayContent.trim().split(/\s+/).filter(Boolean).length}</span>
            </p>
          </div>

          <Input
            type="password"
            placeholder="Exit password"
            value={exitPassword}
            onChange={(e) => { setExitPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleExit()}
            className="font-display"
          />

          {error && <p className="text-destructive text-sm font-display">{error}</p>}

          <Button onClick={handleExit} className="w-full font-display">
            <LogOut className="w-4 h-4 mr-2" />
            Submit Essay & Exit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExitModal;
