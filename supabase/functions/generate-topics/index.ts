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
- Each option must include "focus": a DEEP core thesis of EXACTLY 2 or 3 full sentences (minimum 45 words, ideally 60-100), still in plain B1-B2 English. NEVER one sentence. It must do all three of these, in order:
  (1) state the main arguable claim clearly and take a definite stance (not "both sides have points");
  (2) name the key nuance, condition or tension that makes the claim non-obvious (e.g. "this is true mainly when...", "the real problem is not X but Y");
  (3) point to the analytical direction the essay should take — what kind of evidence or comparison would prove it.
  Never write a vague, generic or descriptive thesis like "AI has both good and bad effects". It must be specific enough that a student can build 3 body paragraphs directly from it.
  Required depth, match this style and length exactly:
  "While automated AI systems increase speed in collaborative environments, offloading core decision-making risks cognitive passivity and diminishes critical evaluation among team members. To preserve human creativity, teams must position AI strictly as an analytical advisor rather than a primary decision-maker. Comparing teams that review AI output line by line with teams that accept it as final would show how much independent judgement is actually lost."
- Each option must include "background": ONE rich research paragraph of 150-200 words with historical, cultural or technical context, real names, dates, numbers and events, still in plain B1-B2 English.
- Each option must include "angles": 3-4 key arguments/perspectives. At least one MUST be a counterargument or nuance. Each is {"label":"short angle name like Over-reliance or Counterargument: algorithmic echo chambers","detail":"one sentence explaining it"}.
- Each option must include "vocabulary": 3-4 useful terms, each {"term":"...","definition":"plain-English definition, max 20 words"}.
- Each option must include "facts": 3-4 short, concrete, verifiable bullet facts (max 20 words each) about the topic.
- Each option must include "guiding_question": ONE thought-provoking question (under 30 words) that helps the student start their first paragraph.
- Keep titles under 12 words.
- Return ONLY valid JSON matching this exact shape: {"topics":[{"title":"...","focus":"...","background":"...","angles":[{"label":"...","detail":"..."}],"vocabulary":[{"term":"...","definition":"..."}],"facts":["...","...","..."],"guiding_question":"..."}]} with exactly 3 topics.
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
    let parsed: { topics?: Array<{ title: string; focus: string; background?: string; facts?: string[] }> } = {};
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