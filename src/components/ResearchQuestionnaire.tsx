import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const QUESTIONNAIRE_VERSION = "q-1.0.0";

const LIKERT = [
  { key: "helpful", label: "The coach's questions helped me think more carefully about my argument." },
  { key: "timing", label: "The questions appeared at useful moments while I was writing." },
  { key: "independence", label: "I stayed in control of my own ideas and wording." },
  { key: "revision", label: "The questions led me to revise something meaningful in my essay." },
  { key: "again", label: "I would want this kind of coach in future writing sessions." },
];

export interface QuestionnaireAnswers {
  version: string;
  ratings: Record<string, number>;
  most_useful: string;
  least_useful: string;
  other: string;
}

interface Props {
  open: boolean;
  submitting?: boolean;
  participantCode?: string | null;
  onSubmit: (answers: QuestionnaireAnswers) => void;
  onSkip: () => void;
}

/** Post-writing feedback questionnaire. Rendered only for research_mode essays. */
const ResearchQuestionnaire = ({ open, submitting, participantCode, onSubmit, onSkip }: Props) => {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [mostUseful, setMostUseful] = useState("");
  const [leastUseful, setLeastUseful] = useState("");
  const [other, setOther] = useState("");

  const complete = LIKERT.every((q) => ratings[q.key]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-xl max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display">Post-writing questionnaire</DialogTitle>
          <DialogDescription className="font-display">
            Your session is submitted. Please answer a few short questions about the writing coach.
            {participantCode ? ` Responses are stored under ${participantCode} only.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {LIKERT.map((q) => (
            <div key={q.key} className="space-y-1.5">
              <p className="font-display text-sm text-foreground">{q.label}</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRatings((r) => ({ ...r, [q.key]: v }))}
                    className={`h-8 w-8 rounded-md border text-xs font-display transition-colors ${
                      ratings[q.key] === v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                    aria-label={`${q.key} ${v}`}
                  >
                    {v}
                  </button>
                ))}
                <span className="self-center ml-2 text-[11px] font-display text-muted-foreground">
                  1 = strongly disagree, 5 = strongly agree
                </span>
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <p className="font-display text-sm text-foreground">Which question was most useful, and why?</p>
            <Textarea value={mostUseful} onChange={(e) => setMostUseful(e.target.value)} rows={2} className="font-display text-sm" />
          </div>
          <div className="space-y-1.5">
            <p className="font-display text-sm text-foreground">Which question was least useful, and why?</p>
            <Textarea value={leastUseful} onChange={(e) => setLeastUseful(e.target.value)} rows={2} className="font-display text-sm" />
          </div>
          <div className="space-y-1.5">
            <p className="font-display text-sm text-foreground">Anything else you want to tell us?</p>
            <Textarea value={other} onChange={(e) => setOther(e.target.value)} rows={2} className="font-display text-sm" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="font-display" onClick={onSkip} disabled={submitting}>
            Skip
          </Button>
          <Button
            className="font-display"
            disabled={!complete || submitting}
            onClick={() =>
              onSubmit({
                version: QUESTIONNAIRE_VERSION,
                ratings,
                most_useful: mostUseful.trim(),
                least_useful: leastUseful.trim(),
                other: other.trim(),
              })
            }
          >
            Submit responses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResearchQuestionnaire;
