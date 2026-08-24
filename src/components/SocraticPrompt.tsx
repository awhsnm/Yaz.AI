import { useState } from "react";
import { HelpCircle, PauseCircle, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CoachQuestion } from "@/hooks/useSocraticCoach";

type Helpfulness = "helpful" | "not_helpful" | "not_sure";

interface Props {
  question: CoachQuestion | null;
  paused: boolean;
  busy: boolean;
  questionsUsed: number;
  questionsMax: number;
  onTogglePause: () => void;
  onAction: (
    action: "answered" | "not_now" | "skipped",
    reflection?: string,
    helpfulness?: Helpfulness | null,
  ) => void;
}

/** Research-mode coach panel. Never rendered for non-research essays. */
const SocraticPrompt = ({
  question,
  paused,
  busy,
  questionsUsed,
  questionsMax,
  onTogglePause,
  onAction,
}: Props) => {
  const { t } = useTranslation();
  const [answering, setAnswering] = useState(false);
  const [reflection, setReflection] = useState("");
  const [helpfulness, setHelpfulness] = useState<Helpfulness | null>(null);

  const reset = () => {
    setAnswering(false);
    setReflection("");
    setHelpfulness(null);
  };

  const submit = (action: "answered" | "not_now" | "skipped") => {
    onAction(action, action === "answered" ? reflection : undefined, helpfulness);
    reset();
  };

  const helpOptions: { key: Helpfulness; label: string }[] = [
    { key: "helpful", label: t("coach.helpful", "Helpful") },
    { key: "not_helpful", label: t("coach.notHelpful", "Not helpful") },
    { key: "not_sure", label: t("coach.notSure", "Not sure") },
  ];

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <HelpCircle className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-display font-semibold text-sm text-foreground">
            {t("coach.title", "Writing Coach")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("coach.subtitle", "Research pilot — questions only")}
          </p>
        </div>
        <span className="text-xs text-muted-foreground font-display">
          {questionsUsed}/{questionsMax}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {question ? (
          <div className="ai-message-enter rounded-lg border border-border bg-muted/50 p-4">
            <p className="font-display text-sm text-foreground leading-relaxed">{question.question}</p>

            {answering ? (
              <div className="mt-3 space-y-3">
                <Textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder={t("coach.reflectionPlaceholder", "Write your thinking here…")}
                  className="font-display text-sm min-h-[110px]"
                  autoFocus
                />
                <div>
                  <p className="text-[11px] uppercase tracking-wide font-display text-muted-foreground mb-1.5">
                    {t("coach.helpfulnessLabel", "Was this question useful?")}
                  </p>
                  <div className="flex gap-1.5">
                    {helpOptions.map((o) => (
                      <button
                        key={o.key}
                        onClick={() => setHelpfulness(helpfulness === o.key ? null : o.key)}
                        className={`text-xs font-display px-2.5 py-1 rounded-full border transition-colors ${
                          helpfulness === o.key
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-display">
                  {t("coach.noReply", "Your response is recorded for the study. The coach will not reply.")}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="font-display text-xs" onClick={() => submit("answered")}>
                    {t("coach.save", "Save response")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-display text-xs"
                    onClick={() => setAnswering(false)}
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" className="font-display text-xs" onClick={() => setAnswering(true)}>
                  {t("coach.answer", "Answer")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-display text-xs"
                  onClick={() => submit("not_now")}
                >
                  {t("coach.notNow", "Not now")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="font-display text-xs"
                  onClick={() => submit("skipped")}
                >
                  {t("coach.skip", "Skip")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-display leading-relaxed">
            {paused
              ? t("coach.pausedBody", "Coach prompts are paused. Resume them whenever you are ready.")
              : busy
                ? t("coach.thinking", "Reading your draft…")
                : t(
                    "coach.idle",
                    "Keep writing. The coach may ask you one short question after you save a paragraph or finish one.",
                  )}
          </p>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={onTogglePause}
          className="w-full font-display text-xs"
        >
          {paused ? (
            <>
              <PlayCircle className="w-3.5 h-3.5 mr-1" />
              {t("coach.resume", "Resume coach prompts")}
            </>
          ) : (
            <>
              <PauseCircle className="w-3.5 h-3.5 mr-1" />
              {t("coach.pause", "Pause coach prompts")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SocraticPrompt;
