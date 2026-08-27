import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, enforceRateLimit, jsonResponse, requireUser } from "../_shared/security.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const limited = await enforceRateLimit(auth.user.id, "delete-account");
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
    const email = (auth.user.email ?? "").trim().toLowerCase();

    if (confirmation !== "DELETE" && confirmation.toLowerCase() !== email) {
      return jsonResponse({ error: "Confirmation text does not match." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const userId = auth.user.id;

    // Remove application data the user owns before deleting the identity.
    await admin.from("essays").delete().eq("student_id", userId);
    await admin.from("bug_reports").delete().eq("user_id", userId);
    await admin.from("research_participants").delete().eq("user_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.from("api_rate_limits").delete().eq("user_id", userId);

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("delete user failed:", error);
      return jsonResponse({ error: "Could not delete account." }, 500);
    }

    return jsonResponse({ deleted: true });
  } catch (e) {
    console.error("delete-account error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
