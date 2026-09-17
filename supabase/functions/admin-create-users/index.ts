import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-setup-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = req.headers.get("x-setup-token");
  if (!token || token !== Deno.env.get("SETUP_TOKEN")) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { users } = await req.json();
  const results: unknown[] = [];
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name ?? u.email.split("@")[0], role: u.role ?? "student" },
    });
    if (!error) {
      results.push({ email: u.email, id: data?.user?.id ?? null, action: "created" });
      continue;
    }
    // Already registered: reset password and confirm the address instead.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
    if (!existing) {
      results.push({ email: u.email, error: error.message });
      continue;
    }
    const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: u.password,
      email_confirm: true,
    });
    results.push({ email: u.email, id: existing.id, action: "updated", error: upErr?.message ?? null });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
