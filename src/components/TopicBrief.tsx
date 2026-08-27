import { useTranslation } from "react-i18next";

export type BriefAngle = { label: string; detail?: string };
export type BriefVocab = { term: string; definition?: string };

export interface TopicBriefData {
  title: string;
  subtitle?: string;
  focus?: string;
  background?: string;
  facts?: string[];
  angles?: BriefAngle[];
  vocabulary?: BriefVocab[];
  guiding_question?: string;
}

/** Shared renderer for the generated topic research brief. */
const TopicBrief = ({ brief }: { brief: TopicBriefData }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <span className="inline-block rounded-full bg-success/15 text-success px-2.5 py-1 text-[10px] uppercase tracking-wider font-display font-bold mb-2">
          {t("modes.researchBrief", "Topic research brief")}
        </span>
        <h3 className="font-display font-bold text-lg text-foreground">{brief.title}</h3>
        {brief.focus && (
          <div className="mt-3 rounded-xl border-l-4 border-success bg-success/10 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-0.5">
              {t("modes.coreThesis", "Core thesis")}
            </p>
            <p className="text-sm font-display text-foreground leading-relaxed">{brief.focus}</p>
          </div>
        )}
      </div>

      {brief.background && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-1">
            {t("modes.background", "Background & context")}
          </p>
          <p className="text-sm font-display text-foreground leading-relaxed">{brief.background}</p>
        </div>
      )}

      {brief.angles && brief.angles.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-2">
            {t("modes.angles", "Key arguments & perspectives to explore")}
          </p>
          <ul className="space-y-2">
            {brief.angles.map((a, i) => (
              <li key={i} className="text-sm font-display text-foreground flex gap-2">
                <span className="text-primary">🔹</span>
                <span>
                  <span className="font-semibold">{a.label}</span>
                  {a.detail ? <span className="text-muted-foreground"> — {a.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.vocabulary && brief.vocabulary.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-2">
            {t("modes.vocabulary", "Key vocabulary & terms")}
          </p>
          <div className="flex flex-wrap gap-2">
            {brief.vocabulary.map((v, i) => (
              <div
                key={i}
                className="rounded-full bg-card border border-warning/40 px-3 py-1.5 text-xs font-display text-foreground"
              >
                <span className="font-semibold">{v.term}</span>
                {v.definition ? <span className="text-muted-foreground"> — {v.definition}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {brief.guiding_question && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-1">
            {t("modes.guidingQuestion", "Suggested guiding question")}
          </p>
          <p className="text-sm font-display italic text-foreground leading-relaxed">{brief.guiding_question}</p>
        </div>
      )}

      {brief.facts && brief.facts.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-2">
            {t("modes.keyFacts", "Key facts")}
          </p>
          <ul className="space-y-1.5">
            {brief.facts.map((f, i) => (
              <li key={i} className="text-sm font-display text-foreground flex gap-2">
                <span className="text-success">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TopicBrief;
