import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const CONSENT_VERSION = "consent-1.0.0";

interface Props {
  open: boolean;
  onAgree: () => void;
  onDecline: () => void;
  submitting?: boolean;
}

/** Research-mode consent gate. Only shown when essays.research_mode is true. */
const ResearchConsentDialog = ({ open, onAgree, onDecline, submitting }: Props) => {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display">
            {t("coach.consentTitle", "Research pilot consent")}
          </DialogTitle>
          <DialogDescription className="font-display leading-relaxed">
            {t(
              "coach.consentBody",
              "I understand that my essay drafts, AI questions, reflections, and writing activity will be recorded for a research pilot. I will not include personal, confidential, or identifying information in my essay.",
            )}
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
          <span className="font-display text-sm text-foreground">
            {t("coach.consentCheckbox", "I have read and understood the statement above.")}
          </span>
        </label>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="font-display" onClick={onDecline} disabled={submitting}>
            {t("coach.consentDecline", "Decline and go back")}
          </Button>
          <Button className="font-display" onClick={onAgree} disabled={!checked || submitting}>
            {t("coach.consentAgree", "I agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResearchConsentDialog;
