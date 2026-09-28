import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Focus / engagement event capture for the writing screen.
 *
 * Stores only raw observable events (tab switches, pauses, AI-panel use,
 * writing activity). All derived metrics (active focus time, sessions,
 * interruptions) are computed later from these rows — no score is stored.
 * Analytics must never disturb writing: failures are swallowed.
 */

export type FocusEventType =
  | "writing_started"
  | "text_changed"
  | "writing_paused"
  | "writing_resumed"
  | "ai_input_focus"
  | "ai_input_blur"
  | "ai_interaction"
  | "tab_hidden"
  | "tab_visible"
  | "window_blurred"
  | "window_focused"
  | "essay_saved";

/** Typing pause before the student counts as inactive. */
const PAUSE_MS = 30_000;
/** Minimum gap between logged text_changed events. */
const TEXT_THROTTLE_MS = 5_000;
const FLUSH_INTERVAL_MS = 10_000;

interface QueuedEvent {
  event_type: FocusEventType;
  created_at: string;
}

interface Params {
  essayId?: string;
  userId?: string;
  enabled: boolean;
}

export function useFocusAnalytics({ essayId, userId, enabled }: Params) {
  const queue = useRef<QueuedEvent[]>([]);
  const flushing = useRef(false);
  const lastTextEvent = useRef(0);
  const started = useRef(false);
  const paused = useRef(false);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (!essayId || !userId || flushing.current || queue.current.length === 0) return;
    const batch = queue.current.splice(0, queue.current.length);
    flushing.current = true;
    try {
      const { error } = await supabase.from("focus_events").insert(
        batch.map((e) => ({
          essay_id: essayId,
          student_id: userId,
          event_type: e.event_type,
          created_at: e.created_at,
        })),
      );
      if (error) queue.current.unshift(...batch); // retry on the next flush
    } catch {
      queue.current.unshift(...batch);
    }
    flushing.current = false;
  }, [essayId, userId]);

  const log = useCallback(
    (type: FocusEventType) => {
      queue.current.push({ event_type: type, created_at: new Date().toISOString() });
      if (queue.current.length >= 25) void flush();
    },
    [flush],
  );

  /** Called on every text change in the editor. */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    if (!started.current) {
      started.current = true;
      paused.current = false;
      log("writing_started");
    } else if (paused.current) {
      paused.current = false;
      log("writing_resumed");
    }
    if (now - lastTextEvent.current >= TEXT_THROTTLE_MS) {
      lastTextEvent.current = now;
      log("text_changed");
    }
    pauseTimer.current = setTimeout(() => {
      paused.current = true;
      log("writing_paused");
    }, PAUSE_MS);
  }, [log]);

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => log(document.hidden ? "tab_hidden" : "tab_visible");
    const onBlur = () => log("window_blurred");
    const onFocus = () => log("window_focused");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onHide);
      clearInterval(interval);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      void flush();
    };
  }, [enabled, log, flush]);

  return { log, notifyTyping };
}
