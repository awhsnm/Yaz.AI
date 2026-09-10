import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props { essayId: string; isSubmitted: boolean }

interface Feedback {
  what_is_working_well: string[] | null;
  next_step_for_revision: string | null;
  revision_question: string | null;
}

/** Student-facing formative feedback. Never shows scores, traits or process data. */
const StudentFeedbackCard = ({ essayId, isSubmitted }: Props) => {
  const [data, setData] = useState<Feedback | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  const load = useCallback(async () => {
    const { data: row } = await supabase
      .from("essay_student_feedback")
      .select("what_is_working_well, next_step_for_revision, revision_question")
      .eq("essay_id", essayId)
      .maybeSingle();
    if (row) {
      setData(row as unknown as Feedback);
      setState("ready");
      return true;
    }
    return false;
  }, [essayId]);

  useEffect(() => {
    if (!isSubmitted) return;
    let cancelled = false;
    (async () => {
      if (await load()) return;
      const { data: res } = await supabase.functions.invoke("generate-essay-feedback", {
        body: { essay_id: essayId, output_type: "student_feedback" },
      });
      if (cancelled) return;
      const fb = (res as { student_feedback?: Feedback } | null)?.student_feedback;
      if (fb && (fb.what_is_working_well?.length || fb.next_step_for_revision)) {
        setData(fb);
        setState("ready");
      } else {
        setState("unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, [essayId, isSubmitted, load]);

  if (!isSubmitted) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
        <MessageCircleQuestion className="w-4 h-4 text-primary" />Your feedback
      </h2>

      {state === "loading" && (
        <p className="text-sm font-display text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />Preparing your writing feedback…
        </p>
      )}

      {state === "unavailable" && (
        <p className="text-sm font-display text-muted-foreground">
          Your essay was submitted successfully. Feedback is not available yet.
        </p>
      )}

      {state === "ready" && data && (
        <div className="space-y-4">
          <div>
            <h3 className="font-display font-medium text-sm text-foreground mb-1">What is working well</h3>
            <ul className="space-y-1 list-disc pl-4">
              {(data.what_is_working_well ?? []).map((s, i) => (
                <li key={i} className="text-sm font-display text-foreground">{s}</li>
              ))}
            </ul>
          </div>
          {data.next_step_for_revision && (
            <div>
              <h3 className="font-display font-medium text-sm text-foreground mb-1">A next step for revision</h3>
              <p className="text-sm font-display text-foreground">{data.next_step_for_revision}</p>
            </div>
          )}
          {data.revision_question && (
            <div className="rounded-md bg-muted p-3">
              <h3 className="font-display font-medium text-sm text-foreground mb-1">Revision question</h3>
              <p className="text-sm font-display text-foreground">{data.revision_question}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentFeedbackCard;
