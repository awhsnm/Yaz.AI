import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  /** Map of YYYY-MM-DD -> word count produced that day. */
  data: Record<string, number>;
}

const DAYS = 365;

const shade = (n: number) => {
  if (n <= 0) return "bg-muted";
  if (n < 50) return "bg-primary/20";
  if (n < 150) return "bg-primary/40";
  if (n < 400) return "bg-primary/70";
  return "bg-primary";
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export const ActivityGrid = ({ data }: Props) => {
  const { t } = useTranslation();

  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (DAYS - 1));
    // Align to Sunday
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1);
    const out: { date: string; count: number }[] = [];
    const cur = new Date(start);
    while (cur <= today) {
      const key = fmt(cur);
      out.push({ date: key, count: data[key] ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [data]);

  // group into columns (weeks)
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      <h2 className="font-display font-semibold text-foreground mb-1">{t("dashboard.activity")}</h2>
      <p className="text-xs text-muted-foreground font-display mb-3">{t("dashboard.activityHint")}</p>
      <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        <div className="flex gap-[3px]">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.map((c) => (
                <div
                  key={c.date}
                  title={`${c.date}: ${c.count} ${t("common.words")}`}
                  className={`w-[11px] h-[11px] rounded-[2px] ${shade(c.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityGrid;