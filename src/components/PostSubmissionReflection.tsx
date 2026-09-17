import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type OutsideSupport = "none" | "class_materials" | "dictionary_translation" | "other";

export interface ReflectionAnswers {
  argument_decision: string;
  revision_note: string;
  outside_support: OutsideSupport;
  outside_support_note: string;
}

const SUPPORT_OPTIONS: Array<{ value: OutsideSupport; label: string }> = [
  { value: "none", label: "No." },
  { value: "class_materials", label: "Teacher-approved class materials." },
  { value: "dictionary_translation", label: "Dictionary or translation support." },
  { value: "other", label: "Other — please describe." },
];

interface Props {
  open: boolean;
  required?: boolean;
  submitting?: boolean;
  onSubmit: (answers: ReflectionAnswers) => void;
  onSkip: () => void;
}

/** Short, calm reflection shown once, after submission. Never used to accuse. */
const PostSubmissionReflection = ({ open, required, submitting, onSubmit, onSkip }: Props) => {
  const [decision, setDecision] = useState("");
  const [revision, setRevision] = useState("");
  const [support, setSupport] = useState<OutsideSupport>("none");
  const [supportNote, setSupportNote] = useState("");

  const complete = decision.trim().length > 0 && revision.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-xl max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display">A short reflection</DialogTitle>
          <DialogDescription className="font-display">
            Your work is submitted. These few lines help your teacher understand your thinking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="font-display text-sm text-foreground">
              What is one decision you made while developing your argument?
            </p>
            <Textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              rows={3}
              className="font-display text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <p className="font-display text-sm text-foreground">
              Which paragraph changed most during revision, and why?
            </p>
            <Textarea
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              rows={3}
              className="font-display text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <p className="font-display text-sm text-foreground">Did you use any support outside Yaz.AI?</p>
            <div className="space-y-1.5">
              {SUPPORT_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 font-display text-sm text-foreground">
                  <input
                    type="radio"
                    name="outside-support"
                    value={o.value}
                    checked={support === o.value}
                    onChange={() => setSupport(o.value)}
                    className="accent-primary"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {support === "other" && (
              <Textarea
                value={supportNote}
                onChange={(e) => setSupportNote(e.target.value)}
                rows={2}
                placeholder="Please describe"
                className="font-display text-sm"
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {!required && (
            <Button variant="outline" className="font-display" onClick={onSkip} disabled={submitting}>
              Skip
            </Button>
          )}
          <Button
            className="font-display"
            disabled={submitting || (required && !complete)}
            onClick={() =>
              onSubmit({
                argument_decision: decision.trim(),
                revision_note: revision.trim(),
                outside_support: support,
                outside_support_note: support === "other" ? supportNote.trim() : "",
              })
            }
          >
            Send reflection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PostSubmissionReflection;
