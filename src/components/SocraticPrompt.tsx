import { useEffect, useState } from "react";
import { HelpCircle, PauseCircle, PlayCircle, Star, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CoachQuestion } from "@/hooks/useSocraticCoach";

interface Props {
  question: CoachQuestion | null;
  snoozed: boolean;
  pendingRatingId: string | null;
  participantCode: string | null;
  paused: boolean;
  busy: boolean;
  questionsUsed: number;
  questionsMax: number;
  onTogglePause: () => void;
  onAction: (action: "answered" | "not_now" | "skipped", reflection?: string) => void;
  onRate: (rating: number | null) => void;
}

/** Research-mode coach panel. Never rendered for non-research essays. */
const SocraticPrompt = ({
  question,
  snoozed,
  pendingRatingId,
  participantCode,
  paused,
  busy,
  questionsUsed,
  questionsMax,
  onTogglePause,
  onAction,
  onRate,
}: Props) => {
  const { t } = useTranslation();
  const [answering, setAnswering] = useState(false);
  const [reflection, setReflection] = useState("");
  const [hovered, setHovered] = useState(0);
  const [fading, setFading] = useState(false);

  // Reset the composer whenever a new question arrives.
  useEffect(() => {
    setAnswering(false);
    setReflection("");
  }, [question?.interventionId]);

  useEffect(() => {
    if (pendingRatingId) {
      setFading(false);
      setHovered(0);
    }
  }, [pendingRatingId]);

  const rate = (n: number | null) => {
    setFading(true);
    setTimeout(() => onRate(n), 260);
  };

  const showCard = !!question && !snoozed;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <HelpCircle className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold text-sm text-foreground">
            {t("coach.title", "Writing Coach")}
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            {participantCode
              ? t("coach.participant", "Participant {{code}}", { code: participantCode })
              : t("coach.subtitle", "Research pilot — questions only")}
          </p>
        </div>
        <span className="text-xs text-muted-foreground font-display">
          {questionsUsed}/{questionsMax}
        </span>
      </div>

      <div className="p-3 border-b border-border">
        <Button
          variant={paused ? "default" : "outline"}
          size="sm"
          onClick={onTogglePause}
          aria-pressed={paused}
          className="w-full font-display text-xs"
        >
          {paused ? (
            <>
              <PlayCircle className="w-3.5 h-3.5 mr-1" />
              {t("coach.resume", "Resume prompts")}
            </>
          ) : (
            <>
              <PauseCircle className="w-3.5 h-3.5 mr-1" />
              {t("coach.pause", "Pause coach prompts")}
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {showCard && (
          <div className="ai-message-enter rounded-lg border border-border bg-muted/50 p-4">
            <p className="font-display text-sm text-foreground leading-relaxed">{question!.question}</p>

            {answering ? (
              <div className="mt-3 space-y-3">
                <Textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder={t("coach.reflectionPlaceholder", "Write your brief reflection here…")}
                  aria-label={t("coach.reflectionPlaceholder", "Write your brief reflection here…")}
                  className="font-display text-sm min-h-[110px]"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground font-display">
                  {t("coach.noReply", "Your response is recorded for the study. The coach will not reply.")}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="font-display text-xs"
                    onClick={() => onAction("answered", reflection)}
                  >
                    {t("coach.submitReflection", "Submit Reflection")}
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
                  onClick={() => onAction("not_now")}
                >
                  {t("coach.notNow", "Not now")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="font-display text-xs"
                  onClick={() => onAction("skipped")}
                >
                  {t("coach.skip", "Skip")}
                </Button>
              </div>
            )}
          </div>
        )}

        {question && snoozed && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs font-display text-muted-foreground">
              {t("coach.snoozed", "Question snoozed. It will return in a few minutes.")}
            </p>
          </div>
        )}

        {pendingRatingId && (
          <div
            className={`rounded-lg border border-border bg-background p-3 transition-opacity duration-250 ${
              fading ? "opacity-0" : "opacity-100"
            }`}
          >
            <p className="text-xs font-display text-foreground mb-2">
              {t("coach.ratingPrompt", "Was this question helpful for your thinking?")}
            </p>
            <div className="flex items-center gap-1" role="group" aria-label={t("coach.ratingPrompt", "Was this question helpful for your thinking?")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => rate(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  onFocus={() => setHovered(n)}
                  onBlur={() => setHovered(0)}
                  aria-label={t("coach.ratingStar", "{{n}} out of 5", { n })}
                  className="p-1 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={`w-4 h-4 ${
                      hovered >= n ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              <button
                type="button"
                onClick={() => rate(null)}
                className="ml-auto text-[11px] font-display text-muted-foreground hover:text-foreground"
              >
                {t("coach.ratingDismiss", "Dismiss")}
              </button>
            </div>
          </div>
        )}

        {!showCard && !pendingRatingId && (
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
    </div>
  );
};

export default SocraticPrompt;
