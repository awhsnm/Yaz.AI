import { supabase } from "@/integrations/supabase/client";

type Severity = "warn" | "error" | "fatal" | "request";

const recent = new Map<string, number>();

/**
 * Records a client-side error or failed request for the admin System Health page.
 * Never throws and never surfaces technical detail to the user.
 */
export async function logError(
  message: string,
  opts: { feature?: string; details?: unknown; severity?: Severity } = {},
): Promise<void> {
  try {
    const key = `${opts.feature ?? ""}|${message}`.slice(0, 200);
    const now = Date.now();
    const last = recent.get(key) ?? 0;
    if (now - last < 10_000) return; // de-duplicate noisy repeats
    recent.set(key, now);

    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id ?? null;

    let details: string | null = null;
    if (opts.details !== undefined) {
      details =
        opts.details instanceof Error
          ? `${opts.details.name}: ${opts.details.message}\n${opts.details.stack ?? ""}`
          : typeof opts.details === "string"
            ? opts.details
            : JSON.stringify(opts.details);
    }

    await supabase.from("error_logs").insert({
      user_id: userId,
      page: window.location.pathname.slice(0, 300),
      feature: opts.feature ?? null,
      message: String(message).slice(0, 1000),
      details: details ? details.slice(0, 4000) : null,
      severity: opts.severity ?? "error",
      user_agent: navigator.userAgent.slice(0, 400),
    });
  } catch {
    /* logging must never break the app */
  }
}

/** Wraps a Supabase error object from a failed request. */
export function logRequestError(feature: string, error: { message?: string } | null) {
  if (!error) return;
  void logError(error.message ?? "Request failed", { feature, severity: "request", details: error });
}
