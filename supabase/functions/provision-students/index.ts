import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, requireUser } from "../_shared/security.ts";

const DEFAULT_PASSWORD = "FocusWrite2026!";
const MAX_BATCH = 60;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface ResultRow {
  email: string;
  password: string | null;
  participant_code: string | null;
  status: "created" | "updated" | "skipped";
  note?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    // Only admins and teachers may provision accounts.
    const { data: isAdmin } = await auth.client.rpc("is_admin");
    const { data: isTeacher } = await auth.client.rpc("has_role", {
      _user_id: auth.user.id,
      _role: "teacher",
    });
    if (!isAdmin && !isTeacher) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const role: "student" | "teacher" = body?.role === "teacher" ? "teacher" : "student";
    const password: string = typeof body?.password === "string" && body.password.length >= 8
      ? body.password
      : DEFAULT_PASSWORD;

    const emails = Array.from(
      new Set(
        String(body?.emails ?? "")
          .split(/[\s,;]+/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => EMAIL_RE.test(s)),
      ),
    ).slice(0, MAX_BATCH);

    if (!emails.length) return jsonResponse({ error: "No valid email addresses provided." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Next pseudonymous participant number.
    const { data: codes } = await admin
      .from("research_participants")
      .select("participant_code");
    let next = 1;
    for (const row of codes ?? []) {
      const m = /^P(\d+)$/.exec(String(row.participant_code ?? ""));
      if (m) next = Math.max(next, Number(m[1]) + 1);
    }

    const results: ResultRow[] = [];

    for (const email of emails) {
      let userId: string | null = null;
      let status: ResultRow["status"] = "created";
      let note: string | undefined;

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role },
      });

      if (createErr) {
        // Already registered: reset the password and confirm the address instead.
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
        if (!existing) {
          results.push({ email, password: null, participant_code: null, status: "skipped", note: createErr.message });
          continue;
        }
        const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
        });
        if (updErr) {
          results.push({ email, password: null, participant_code: null, status: "skipped", note: updErr.message });
          continue;
        }
        userId = existing.id;
        status = "updated";
        note = "Existing account — password reset";
      } else {
        userId = created?.user?.id ?? null;
      }

      if (!userId) {
        results.push({ email, password: null, participant_code: null, status: "skipped", note: "No user id" });
        continue;
      }

      // Allowlist entry (active, so the beta gate lets them in immediately).
      await admin
        .from("beta_allowlist")
        .upsert({ email, role, status: "active" }, { onConflict: "email" });

      // Role record.
      await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

      // Pseudonymous participant code.
      const { data: existingP } = await admin
        .from("research_participants")
        .select("participant_code")
        .eq("user_id", userId)
        .maybeSingle();

      let code = existingP?.participant_code ?? null;
      if (!code) {
        code = `P${String(next).padStart(2, "0")}`;
        next += 1;
        const { error: pErr } = await admin
          .from("research_participants")
          .insert({ user_id: userId, participant_code: code });
        if (pErr) code = null;
      }

      results.push({ email, password, participant_code: code, status, note });
    }

    return jsonResponse({ results });
  } catch (e) {
    console.error("provision-students error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
