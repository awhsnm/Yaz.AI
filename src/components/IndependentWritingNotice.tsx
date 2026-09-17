import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onAccept: () => void;
}

/**
 * Neutral acknowledgement shown once before a classroom assignment starts.
 * It states the expectation; it never threatens or claims detection.
 */
const IndependentWritingNotice = ({ open, busy, onCancel, onAccept }: Props) => {
  const [checked, setChecked] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setChecked(false); onCancel(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Independent writing task</DialogTitle>
          <DialogDescription className="font-display leading-relaxed">
            Write using your own ideas and wording. Yaz.AI may ask questions to help you reflect, but it
            will not write sentences, paragraphs, or answers for you. Do not use external AI tools,
            websites, translators, or other people to generate essay wording during this task.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-start gap-2 font-display text-sm text-foreground">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
          I understand and will complete this task independently.
        </label>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="font-display" onClick={() => { setChecked(false); onCancel(); }} disabled={busy}>
            Cancel
          </Button>
          <Button className="font-display" disabled={!checked || busy} onClick={onAccept}>
            Start writing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IndependentWritingNotice;
