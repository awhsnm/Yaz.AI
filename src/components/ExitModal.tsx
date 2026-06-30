import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleExit = async () => {
    setError("");
    if (!essayId) return;
    setBusy(true);

    // Save the latest content first (essay is locked but not yet finalized)
    await supabase.from("essays").update({ content: essayContent }).eq("id", essayId);

    // Look up the classroom's exit password via the essay
    const { data: e } = await supabase
      .from("essays")
      .select("classroom_id")
      .eq("id", essayId)
      .maybeSingle();

    if (!e?.classroom_id) {
      setBusy(false);
      setError(t("exit.wrong"));
      return;
    }

    const { data: c } = await supabase
      .from("classrooms")
      .select("exit_password")
      .eq("id", e.classroom_id)
      .maybeSingle();

    setBusy(false);

    if (!c?.exit_password || exitPassword.trim().toUpperCase() !== c.exit_password.toUpperCase()) {
      setError(t("exit.wrong"));
      return;
    }

    await supabase.from("essays").update({ is_submitted: true }).eq("id", essayId);
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
          <DialogTitle className="text-center font-display">{t("exit.title")}</DialogTitle>
          <DialogDescription className="text-center font-display">
            {t("exit.body")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground font-display">
              {t("common.words")}: <span className="font-semibold text-foreground">{essayContent.trim().split(/\s+/).filter(Boolean).length}</span>
            </p>
          </div>

          <Input
            type="password"
            placeholder={t("exit.pw")}
            value={exitPassword}
            onChange={(e) => { setExitPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleExit()}
            className="font-display"
          />

          {error && <p className="text-destructive text-sm font-display">{error}</p>}

          <Button onClick={handleExit} disabled={busy} className="w-full font-display">
            <LogOut className="w-4 h-4 mr-2" />
            {t("exit.submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExitModal;
