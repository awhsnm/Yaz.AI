import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Simple per-user throttle against invite-code guessing. */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 10 * 60 * 1000;

/** Constant-time string comparison. */
function safeEqual(a: string, b: string) {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const now = Date.now();
    const record = attempts.get(user.id);
    if (record && record.count >= MAX_ATTEMPTS && record.until > now) {
      return json({ error: "too_many_attempts" }, 429);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    const code = (body as { code?: unknown })?.code;
    if (typeof code !== "string" || code.length < 1 || code.length > 64) {
      return json({ error: "invalid_body" }, 400);
    }

    const expected = Deno.env.get("RESEARCH_PILOT_INVITE_CODE") ?? "";
    if (!expected || !safeEqual(code.trim().toUpperCase(), expected.trim().toUpperCase())) {
      const next = record && record.until > now ? record.count + 1 : 1;
      attempts.set(user.id, { count: next, until: now + COOLDOWN_MS });
      return json({ error: "invalid_code" }, 403);
    }
    attempts.delete(user.id);

    // Pseudonymous participant record (P01, P02, ...) — created under the user's own auth.
    const { data: participantData, error: pErr } = await userClient.rpc("ensure_research_participant");
    if (pErr) return json({ error: "participant_failed" }, 500);
    const participant = (Array.isArray(participantData) ? participantData[0] : participantData) as
      | { id: string; participant_code: string; consented_at: string | null }
      | null;
    if (!participant) return json({ error: "participant_failed" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Reuse an unsubmitted pilot essay if one already exists for this participant.
    const { data: existing } = await admin
      .from("essays")
      .select("id")
      .eq("student_id", user.id)
      .eq("research_mode", true)
      .eq("is_submitted", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return json({
        essay_id: existing.id,
        participant_code: participant.participant_code,
        consented: !!participant.consented_at,
      });
    }

    const topic = typeof (body as { topic?: unknown }).topic === "string"
      ? ((body as { topic: string }).topic).slice(0, 300)
      : "";

    const { data: created, error: eErr } = await admin
      .from("essays")
      .insert({
        student_id: user.id,
        topic: topic || "Research pilot writing session",
        subject: "English",
        mode: "solo",
        research_mode: true,
        classroom_id: null,
        duration_minutes: 45,
      })
      .select("id")
      .single();

    if (eErr || !created) return json({ error: "essay_failed" }, 500);

    return json({
      essay_id: created.id,
      participant_code: participant.participant_code,
      consented: !!participant.consented_at,
    });
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
});
