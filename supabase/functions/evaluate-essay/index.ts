import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an academic essay examiner assessing a high school student's essay (English B1-B2 level).
Grade strictly and fairly against a 100-point, 4-pillar rubric. Each criterion is scored 0-25.

CRITERION 1 — Task Response & Thesis Strength (0-25)
Clarity of the central thesis, sustained focus, and how comprehensively the prompt is addressed.

CRITERION 2 — Argumentation & Counterarguments (0-25)
Depth and relevance of evidence, logical reasoning, and presence of a genuine, balanced counterargument.

CRITERION 3 — Structure & Cohesion (0-25)
Paragraph flow, presence and quality of topic sentences, logical transitions, coherent progression.

CRITERION 4 — Vocabulary & Grammatical Precision (0-25)
Natural academic tone, lexical range and accuracy, sentence variety, grammatical control.

RULES
- Never rewrite the essay. Never supply replacement text longer than 15 words.
- Be diagnostic and concrete: name the paragraph number where an issue occurs (e.g. "Paragraph 3 has no counterargument").
- Each explanation is exactly one sentence justifying that criterion's score.
- Calm, neutral academic tone. No greetings, praise inflation, emojis, or filler.
- "band" is one of: Emerging Writer (0-49), Developing Writer (50-64), Competent Writer (65-79), Proficient Writer (80-89), Distinguished Writer (90-100).
- Weak sections in "weak_excerpts" MUST be verbatim substrings copied exactly from the essay (10-200 characters each), each with a one-sentence reason.

Return ONLY valid JSON of this exact shape, no prose, no markdown, no code fences:
{
  "total": 0,
  "band": "...",
  "criteria": [
    {"key":"task_response","label":"Task Response & Thesis Strength","score":0,"max":25,"explanation":"..."},
    {"key":"argumentation","label":"Argumentation & Counterarguments","score":0,"max":25,"explanation":"..."},
    {"key":"structure","label":"Structure & Cohesion","score":0,"max":25,"explanation":"..."},
    {"key":"language","label":"Vocabulary & Grammatical Precision","score":0,"max":25,"explanation":"..."}
  ],
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "suggestions": ["...", "..."],
  "weak_excerpts": [{"excerpt":"...","reason":"..."}]
}`;

const clampScore = (v: unknown) => {
  const n = typeof v === "number" ? Math.round(v) : parseInt(String(v ?? 0), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(25, n));
};

const DEFAULT_LABELS: Record<string, string> = {
  task_response: "Task Response & Thesis Strength",
  argumentation: "Argumentation & Counterarguments",
  structure: "Structure & Cohesion",
  language: "Vocabulary & Grammatical Precision",
};

const bandFor = (total: number) =>
  total >= 90 ? "Distinguished Writer"
    : total >= 80 ? "Proficient Writer"
    : total >= 65 ? "Competent Writer"
    : total >= 50 ? "Developing Writer"
    : "Emerging Writer";

const asStringList = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, max) : [];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, subject, content } = await req.json();
    if (!content || typeof content !== "string" || content.trim().split(/\s+/).filter(Boolean).length < 20) {
      return new Response(JSON.stringify({ error: "Essay is too short to evaluate." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Number the paragraphs so the model can reference them precisely.
    const numbered = content
      .split(/\n{2,}/)
      .map((p, i) => `[Paragraph ${i + 1}] ${p.trim()}`)
      .filter((p) => p.length > 14)
      .join("\n\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `TOPIC: ${topic ?? "(none)"}\nSUBJECT: ${subject ?? "(none)"}\n\nESSAY:\n${numbered || content}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const order = ["task_response", "argumentation", "structure", "language"];
    const incoming = Array.isArray(parsed.criteria) ? parsed.criteria as Record<string, unknown>[] : [];
    const criteria = order.map((key, idx) => {
      const found = incoming.find((c) => c?.key === key) ?? incoming[idx] ?? {};
      return {
        key,
        label: typeof found.label === "string" && found.label ? found.label : DEFAULT_LABELS[key],
        score: clampScore(found.score),
        max: 25,
        explanation: typeof found.explanation === "string" ? found.explanation : "",
      };
    });

    const total = criteria.reduce((s, c) => s + c.score, 0);

    const weak = Array.isArray(parsed.weak_excerpts)
      ? (parsed.weak_excerpts as Record<string, unknown>[])
          .filter((w) => typeof w?.excerpt === "string" && content.includes(w.excerpt as string))
          .slice(0, 8)
          .map((w) => ({ excerpt: w.excerpt as string, reason: typeof w.reason === "string" ? w.reason : "" }))
      : [];

    return new Response(JSON.stringify({
      total,
      band: bandFor(total),
      criteria,
      strengths: asStringList(parsed.strengths, 3),
      improvements: asStringList(parsed.improvements, 5),
      suggestions: asStringList(parsed.suggestions, 5),
      weak_excerpts: weak,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("evaluate-essay error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
