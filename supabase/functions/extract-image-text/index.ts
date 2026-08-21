import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { image } = await req.json();
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "A base64 image data URL is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract study material from photos (textbook pages, handwritten notes, assignment sheets, whiteboards). Transcribe all readable text faithfully. If the image is mostly a diagram or drawing, describe its academic content in a few sentences instead. Reply with plain text only — no markdown, no commentary, no headings.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the text and study context from this image so a student can brainstorm essay topics from it." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const detail = await aiResp.text();
      console.error("AI gateway error", aiResp.status, detail);
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 502;
      return new Response(
        JSON.stringify({
          error:
            aiResp.status === 429
              ? "Too many requests — please wait a moment and try again."
              : aiResp.status === 402
              ? "AI credits are exhausted. Please add credits to continue."
              : "AI service error",
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const text = (aiJson.choices?.[0]?.message?.content ?? "").trim();

    return new Response(JSON.stringify({ text }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-image-text error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
