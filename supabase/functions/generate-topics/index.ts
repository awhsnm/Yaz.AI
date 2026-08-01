import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a friendly writing coach for high school students in Kazakhstan who write in English.
A student will share unstructured thoughts, interests, or a rough idea in any language.

Your task: return exactly 3 essay topic options based on their input.

Rules:
- Respond in the SAME language the student used.
- Use clear, natural, engaging English at a B1-B2 level. Plain everyday words.
- NO academic jargon, no "discourse", "paradigm", "socio-cultural", no research-paper phrasing.
- Topics must still be deep and thought-provoking, but instantly understandable at first read.
- Each option must have a specific, arguable title (not vague).
- Each option must include a one-sentence focus summary written in the same simple, friendly style.
- Keep titles under 12 words and summaries under 25 words.
- Return ONLY valid JSON matching this exact shape: {"topics":[{"title":"...","focus":"..."},{"title":"...","focus":"..."},{"title":"...","focus":"..."}]}
- No prose, no markdown, no code fences.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { input } = await req.json();
    if (!input || typeof input !== "string" || !input.trim()) {
      return new Response(JSON.stringify({ error: "Input required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input.trim() },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: { topics?: Array<{ title: string; focus: string }> } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 3) : [];

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-topics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});