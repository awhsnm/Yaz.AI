import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Proactive Socratic coach — RESEARCH MODE ONLY.
 *
 * This hook is completely inert when `researchMode` is false: it registers no
 * timers, performs no network calls, and returns a frozen empty state, so
 * non-research essays behave exactly as before.
 */

export type CoachStage = "planning" | "drafting" | "revising" | "final";
export type TriggerEvent =
  | "paragraph_saved"
  | "paragraph_boundary_pause"
  | "first_draft_save"
  | "revision_mode_entered";

export interface CoachQuestion {
  interventionId: string;
  question: string;
  paragraphIndex: number;
}

const MIN_WORDS = 100;
const MAX_QUESTIONS = 5;
const PAUSE_MS = 8000; // typing pause after a paragraph boundary
const COOLDOWN_MS = 90000; // minimum gap between shown questions
const SNOOZE_MS = 180000; // "Not now" hides the card for 3 minutes
const AFTER_SNAPSHOT_MS = 60000; // resumed-typing window for the after snapshot

const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

interface Params {
  essayId?: string;
  researchMode: boolean;
  text: string;
  isSubmitted: boolean;
  enabled: boolean;
}

export function useSocraticCoach({ essayId, researchMode, text, isSubmitted, enabled }: Params) {
  const active = researchMode && enabled && !isSubmitted && !!essayId;

  const [question, setQuestion] = useState<CoachQuestion | null>(null);
  const [snoozed, setSnoozed] = useState(false);
  const [pendingRatingId, setPendingRatingId] = useState<string | null>(null);
  const [participantCode, setParticipantCode] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [stage, setStage] = useState<CoachStage>("planning");
  const [busy, setBusy] = useState(false);

  const textRef = useRef(text);
  const stageRef = useRef<CoachStage>(stage);
  const pausedRef = useRef(paused);
  const usedRef = useRef(0);
  const lastShownAt = useRef(0);
  const lastSavedBaseline = useRef<string | null>(null);
  const hasSavedOnce = useRef(false);
  const participantId = useRef<string | null>(null);
  const analysing = useRef(false);
  const pendingAfterFor = useRef<string | null>(null);

  textRef.current = text;
  stageRef.current = stage;
  pausedRef.current = paused;

  /** Ensure the pseudonymous participant record exists (P01, P02, …). */
  const ensureParticipant = useCallback(async () => {
    if (participantId.current) return participantId.current;
    const { data, error } = await supabase.rpc("ensure_research_participant");
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    participantId.current = (row as { id: string }).id;
    return participantId.current;
  }, []);

  // Load current budget for this essay.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("essays")
        .select("coach_questions_used, text_stage")
        .eq("id", essayId!)
        .maybeSingle();
      if (cancelled || !data) return;
      usedRef.current = data.coach_questions_used ?? 0;
      setQuestionsUsed(usedRef.current);
      const s = (data.text_stage as CoachStage) ?? "planning";
      setStage(s);
      if (s !== "planning") hasSavedOnce.current = true;
      ensureParticipant();
    })();
    return () => {
      cancelled = true;
    };
  }, [active, essayId, ensureParticipant]);

  const persistStage = useCallback(
    async (next: CoachStage) => {
      if (!essayId) return;
      setStage(next);
      stageRef.current = next;
      await supabase.from("essays").update({ text_stage: next }).eq("id", essayId);
    },
    [essayId],
  );

  const latestSnapshotId = useCallback(async () => {
    if (!essayId) return null;
    const { data } = await supabase
      .from("writing_events")
      .select("id")
      .eq("essay_id", essayId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }, [essayId]);

  /** Index of the paragraph the student most recently completed. */
  const currentParagraphIndex = useCallback(() => {
    const parts = textRef.current.split(/\n\s*\n/);
    return Math.max(0, parts.length - 1);
  }, []);

  const runAnalysis = useCallback(
    async (trigger: TriggerEvent) => {
      if (!active || analysing.current) return;
      if (pausedRef.current) return;
      if (question) return; // a card is already on screen
      if (usedRef.current >= MAX_QUESTIONS) return;
      if (countWords(textRef.current) < MIN_WORDS) return;
      if (Date.now() - lastShownAt.current < COOLDOWN_MS) return;

      analysing.current = true;
      setBusy(true);
      try {
        const snapshotBeforeId = await latestSnapshotId();
        const { data, error } = await supabase.functions.invoke("socratic-coach", {
          body: {
            essay_id: essayId,
            trigger_event: trigger,
            paragraph_index: currentParagraphIndex(),
            text_stage: stageRef.current,
            coach_paused: pausedRef.current,
            snapshot_before_id: snapshotBeforeId,
          },
        });
        if (error || !data?.intervene) return;
        usedRef.current = data.questions_used ?? usedRef.current + 1;
        setQuestionsUsed(usedRef.current);
        lastShownAt.current = Date.now();
        setQuestion({
          interventionId: data.intervention_id,
          question: data.question,
          paragraphIndex: data.paragraph_index ?? 0,
        });
      } catch (e) {
        console.error("socratic-coach invoke failed:", e);
      } finally {
        analysing.current = false;
        setBusy(false);
      }
    },
    [active, essayId, question, latestSnapshotId, currentParagraphIndex],
  );

  /**
   * Called from existing save actions in the workspace — no new save UI.
   * The first explicit save moves the stage from planning to drafting.
   */
  const notifySave = useCallback(async () => {
    if (!active) return;
    const first = !hasSavedOnce.current;
    hasSavedOnce.current = true;
    lastSavedBaseline.current = textRef.current;
    if (stageRef.current === "planning") await persistStage("drafting");
    await runAnalysis(first ? "first_draft_save" : "paragraph_saved");
  }, [active, persistStage, runAnalysis]);

  /** Stage becomes `revising` when saved text is edited rather than extended. */
  useEffect(() => {
    if (!active) return;
    const baseline = lastSavedBaseline.current;
    if (!baseline || stageRef.current !== "drafting") return;
    if (text.length >= baseline.length && text.startsWith(baseline)) return;
    (async () => {
      await persistStage("revising");
      await runAnalysis("revision_mode_entered");
    })();
  }, [text, active, persistStage, runAnalysis]);

  /** Blank-line paragraph boundary followed by a typing pause. */
  useEffect(() => {
    if (!active) return;
    if (!/\n\s*\n\s*$/.test(text)) return;
    const t = setTimeout(() => {
      if (textRef.current === text) runAnalysis("paragraph_boundary_pause");
    }, PAUSE_MS);
    return () => clearTimeout(t);
  }, [text, active, runAnalysis]);

  /** Records whether the targeted paragraph changed after the intervention. */
  const attachAfterSnapshot = useCallback(
    async (interventionId: string, paragraphIndex: number, before: string) => {
      pendingAfterFor.current = interventionId;
      setTimeout(async () => {
        if (pendingAfterFor.current !== interventionId) return;
        const afterId = await latestSnapshotId();
        const beforePara = before.split(/\n\s*\n/)[paragraphIndex] ?? null;
        const afterPara = textRef.current.split(/\n\s*\n/)[paragraphIndex] ?? null;
        const changed =
          beforePara === null && afterPara === null ? null : beforePara !== afterPara;
        await supabase
          .from("coach_interventions")
          .update({ snapshot_after_id: afterId, target_paragraph_changed: changed })
          .eq("id", interventionId);
      }, 60000);
    },
    [latestSnapshotId],
  );

  const recordAction = useCallback(
    async (
      action: "answered" | "not_now" | "skipped",
      reflection?: string,
      helpfulness?: "helpful" | "not_helpful" | "not_sure" | null,
    ) => {
      const q = question;
      if (!q) return;
      const before = textRef.current;
      setQuestion(null);
      await supabase
        .from("coach_interventions")
        .update({
          user_action: action,
          reflection_response: reflection?.trim() ? reflection.trim() : null,
          question_helpfulness: helpfulness ?? null,
        })
        .eq("id", q.interventionId);
      attachAfterSnapshot(q.interventionId, q.paragraphIndex, before);
    },
    [question, attachAfterSnapshot],
  );

  const togglePause = useCallback(async () => {
    if (!active) return;
    const next = !pausedRef.current;
    setPaused(next);
    pausedRef.current = next;
    const pid = await ensureParticipant();
    if (!pid) return;
    await supabase.from("coach_pause_events").insert({
      essay_id: essayId!,
      participant_id: pid,
      paused: next,
      word_count: countWords(textRef.current),
    });
  }, [active, essayId, ensureParticipant]);

  /** Marks the essay stage as final — called from existing submit flow. */
  const notifySubmitted = useCallback(async () => {
    if (!active) return;
    await persistStage("final");
  }, [active, persistStage]);

  return {
    active,
    question,
    paused,
    busy,
    stage,
    questionsUsed,
    questionsMax: MAX_QUESTIONS,
    togglePause,
    recordAction,
    notifySave,
    notifySubmitted,
  };
}
