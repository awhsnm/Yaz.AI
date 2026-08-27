import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Returns a client bound to the caller's JWT (RLS applies) plus the verified user. */
export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) } as const;
  }
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) } as const;
  }
  return { client, user: data.user, authHeader } as const;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Sliding-window limiter: max 5 calls per minute per user per function.
 * Returns a 429 Response when the caller is over budget, otherwise null.
 */
export async function enforceRateLimit(userId: string, fn: string): Promise<Response | null> {
  try {
    const admin = adminClient();
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const { count, error } = await admin
      .from("api_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("fn", fn)
      .gte("called_at", since);

    if (error) {
      console.error("rate limit read failed:", error);
      return null; // fail open rather than block legitimate work
    }
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return jsonResponse(
        { error: "Too many requests. Please wait a minute before trying again." },
        429,
      );
    }

    await admin.from("api_rate_limits").insert({ user_id: userId, fn });
    // Opportunistic cleanup of old rows.
    if (Math.random() < 0.05) {
      await admin
        .from("api_rate_limits")
        .delete()
        .lt("called_at", new Date(Date.now() - 3_600_000).toISOString());
    }
    return null;
  } catch (e) {
    console.error("rate limit error:", e);
    return null;
  }
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|prompts?|rules?|directions?)/gi,
  /disregard\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier|system)\s+(instructions?|prompts?|rules?)/gi,
  /forget\s+(everything|all)\s+(you|above|before)[^.\n]*/gi,
  /you\s+are\s+now\s+(a|an)\s+[^.\n]{0,60}/gi,
  /(system|developer)\s*(prompt|message)\s*[:>]/gi,
  /<\s*\/?\s*(system|assistant|user)\s*>/gi,
  /\[\s*\/?\s*(system|inst|assistant)\s*\]/gi,
  /^\s*(system|assistant)\s*:/gim,
  /###\s*(system|instruction)s?/gi,
  /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?)/gi,
  /act\s+as\s+(a\s+|an\s+)?(dan|jailbroken|unrestricted)[^.\n]*/gi,
  /write\s+(the\s+)?(whole|entire|full)\s+essay\s+for\s+me/gi,
];

/** Strips prompt-injection markers and caps length before text reaches the model. */
export function sanitizeUserText(input: unknown, maxLength = 20_000): string {
  if (typeof input !== "string") return "";
  let text = input.slice(0, maxLength);
  // Remove zero-width / control characters used to hide payloads.
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\u2028\u2029\uFEFF]/g, "");
  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, "[removed]");
  }
  return text.trim();
}
