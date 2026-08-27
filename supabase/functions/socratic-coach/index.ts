import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enforceRateLimit, sanitizeUserText } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const INTERVENTION_VERSION = "iv-1.0.0";
export const SYSTEM_PROMPT_VERSION = "sp-1.0.0";
const MODEL = "google/gemini-3.6-flash";

const MAX_PER_ESSAY = 5;
const MIN_WORDS = 100;

const ALLOWED_TRIGGERS = [
  "paragraph_saved",
  "paragraph_boundary_pause",
  "first_draft_save",
  "revision_mode_entered",
];

const CATEGORIES = [
  "unclear_or_broad_thesis",
  "thesis_claim_evidence_conclusion_inconsistency",
  "unsupported_claim",
  "evidence_without_link",
  "hidden_assumption",
  "missing_or_weak_counterargument",
  "overgeneralisation",
  "conclusion_mismatch",
  "surface_only_revision",
];

const SYSTEM_PROMPT = `You are a Socratic writing coach observing a student's developing argumentative essay.
You never teach by telling. You teach only by asking.

YOUR TASK
Read the student's draft. Decide whether there is ONE meaningful reasoning issue
worth raising right now. If there is, output ONE short Socratic question that helps
the student notice it themselves.

ISSUE CATEGORIES (choose at most one)
1. unclear_or_broad_thesis
2. thesis_claim_evidence_conclusion_inconsistency
3. unsupported_claim
4. evidence_without_link
5. hidden_assumption
6. missing_or_weak_counterargument
7. overgeneralisation
8. conclusion_mismatch
9. surface_only_revision

PRIORITY ORDER
Global coherence and thesis-claim-evidence consistency come first.
Raise local or language-level concerns only when no global issue exists.

POSITION CHANGE
A change in the student's position is NOT an error. If the position has shifted,
ask a question that helps the student judge whether their view has developed,
been qualified, or become inconsistent. Never ask them to return to their
original thesis. Never state that the student is wrong.

UNCERTAINTY
If you are not confident a meaningful issue exists, do not interrupt.
Return intervene = false. Silence is a valid and preferred answer.

TONE (STRICT)
No greeting, no self-introduction, no emojis, no exclamation marks.
No praise, compliments, or motivational language. No capability menus or option lists.
No filler preamble — the question is the entire reply.

ABSOLUTE PROHIBITIONS
Do not write or suggest essay text, paragraphs, thesis statements, topic sentences,
evidence, examples, citations, sources, outlines, summaries, or rewrites.
Do not praise, grade, score, label, analyse aloud, or explain your reasoning.
Do not give the answer inside the question.
Do not ask more than one question.


QUESTION FORM (ABSOLUTE)
Output EXACTLY ONE sentence: a single question, strictly under 25 words, ending with one question mark.
No second question, no explanation, no preamble, no bullets, no lecturing.
Use clear, natural language a high school student understands; avoid technical or academic jargon unless the student used it first.
Open-ended (starts with What / How / Why / Which / In what way / Where).
Grounded in the student's actual wording — you may quote at most 6 of their words.

OUTPUT FORMAT
Return ONLY this JSON object and nothing else:
{"intervene": true|false, "issue_category": "<category or none>",
 "paragraph_index": <integer>, "question": "<question or empty string>"}`;

const OPENERS = [
  "what", "how", "why", "which", "where", "in what way", "to what extent", "how might",
];

const GENERATION_PHRASES = [
  "you could write", "you might write", "try writing", "here is", "here's",
  "rewrite it as", "consider adding the sentence", "for example, \"", "such as: \"",
  "your thesis could", "a stronger version would be", "i suggest writing",
];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Server-side guard: reject anything that is not a single bare Socratic question. */
export function sanitiseQuestion(q: unknown, draft: string): string | null {
  if (typeof q !== "string") return null;
  const question = q.trim();
  if (!question) return null;
  if (/[\n\r]/.test(question)) return null;
  if (/```|^[-*•>]|\d\.\s/.test(question)) return null;
  if (!question.endsWith("?")) return null;
  if ((question.match(/\?/g) ?? []).length !== 1) return null;
  if (question.length > 180) return null;
  // Single sentence only: no statement may precede or follow the question.
  if (/[.!]\s/.test(question)) return null;
  const w = words(question);
  if (w.length > 25) return null;

  const lower = question.toLowerCase();
  if (!OPENERS.some((o) => lower.startsWith(o))) return null;
  if (GENERATION_PHRASES.some((p) => lower.includes(p))) return null;

  // Reject long verbatim spans lifted from the student's own draft (>6 words).
  const draftLower = ` ${draft.toLowerCase().replace(/\s+/g, " ")} `;
  const qw = lower.replace(/[^\w\s']/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i + 7 <= qw.length; i++) {
    const span = qw.slice(i, i + 7).join(" ");
    if (draftLower.includes(` ${span} `)) return null;
  }
  return question;
}

async function callModel(apiKey: string, userContent: string, strictRetry: boolean) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(strictRetry
      ? [{
          role: "system",
          content:
            "Your previous output violated the rules. Output ONLY the JSON object. The question must be one open-ended sentence under 25 words, must not contain any suggested essay text, and must end with a single question mark.",
        }]
      : []),
    { role: "user", content: userContent },
  ];

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
  });
  return resp;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const limited = await enforceRateLimit(user.id, "socratic-coach");
    if (limited) return limited;

    const body = await req.json();
    const essayId: string = body?.essay_id;
    const triggerEvent: string = body?.trigger_event;
    const paragraphIndex: number = Number(body?.paragraph_index ?? 0);
    const textStage: string = body?.text_stage ?? "drafting";
    const coachPaused: boolean = !!body?.coach_paused;
    const snapshotBeforeId: string | null = body?.snapshot_before_id ?? null;

    if (!essayId || !ALLOWED_TRIGGERS.includes(triggerEvent)) {
      return json({ error: "Invalid request" }, 400);
    }

    // Ownership + research mode + budget, read server-side (client cannot lie).
    const { data: essay } = await supabase
      .from("essays")
      .select("id, student_id, topic, subject, content, research_mode, coach_questions_used, is_submitted")
      .eq("id", essayId)
      .maybeSingle();

    if (!essay || essay.student_id !== user.id) return json({ error: "Not found" }, 404);
    if (!essay.research_mode) return json({ intervene: false, suppressed_reason: "not_research_mode" });
    if (essay.is_submitted) return json({ intervene: false, suppressed_reason: "submitted" });

    const { data: participant, error: pErr } = await supabase.rpc("ensure_research_participant");
    if (pErr || !participant) return json({ error: "Participant record unavailable" }, 500);
    const participantId = (Array.isArray(participant) ? participant[0] : participant).id;

    const draft: string = sanitizeUserText(essay.content ?? "");
    const wordCount = words(draft).length;

    const logSuppressed = async (reason: string, category = "none") => {
      await supabase.from("coach_interventions").insert({
        essay_id: essayId,
        participant_id: participantId,
        text_stage: textStage,
        word_count: wordCount,
        trigger_event: triggerEvent,
        issue_category: category,
        paragraph_index: paragraphIndex,
        question_shown: null,
        suppressed_reason: reason,
        snapshot_before_id: snapshotBeforeId,
        intervention_version: INTERVENTION_VERSION,
        system_prompt_version: SYSTEM_PROMPT_VERSION,
        model: MODEL,
        coach_paused: coachPaused,
      });
    };

    if (coachPaused) {
      await logSuppressed("coach_paused");
      return json({ intervene: false, suppressed_reason: "coach_paused" });
    }
    if (wordCount < MIN_WORDS) {
      return json({ intervene: false, suppressed_reason: "not_eligible" });
    }

    const { data: prior } = await supabase
      .from("coach_interventions")
      .select("id, paragraph_index, issue_category, question_shown")
      .eq("essay_id", essayId)
      .not("question_shown", "is", null);

    const shown = prior ?? [];
    if (shown.length >= MAX_PER_ESSAY || (essay.coach_questions_used ?? 0) >= MAX_PER_ESSAY) {
      await logSuppressed("budget_essay");
      return json({ intervene: false, suppressed_reason: "budget_essay" });
    }
    if (shown.some((r) => r.paragraph_index === paragraphIndex)) {
      await logSuppressed("budget_paragraph");
      return json({ intervene: false, suppressed_reason: "budget_paragraph" });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY is not configured" }, 500);

    const paragraphs = draft.split(/\n\s*\n/).map((p, i) => `[${i}] ${p.trim()}`).filter((p) => p.length > 4);
    const usedCategories = shown.map((r) => r.issue_category).filter(Boolean);
    const usedParagraphs = shown.map((r) => r.paragraph_index);

    const userContent = [
      `TOPIC: ${sanitizeUserText(essay.topic, 300) || "(none)"}`,
      `SUBJECT: ${sanitizeUserText(essay.subject, 120) || "(none)"}`,
      `TEXT STAGE: ${textStage}`,
      `WORD COUNT: ${wordCount}`,
      `TRIGGER: ${triggerEvent}`,
      `ALREADY RAISED CATEGORIES: ${usedCategories.join(", ") || "(none)"}`,
      `ALREADY QUESTIONED PARAGRAPHS: ${usedParagraphs.join(", ") || "(none)"}`,
      "",
      "NUMBERED PARAGRAPHS:",
      paragraphs.join("\n\n"),
    ].join("\n");

    let parsed: { intervene?: boolean; issue_category?: string; paragraph_index?: number; question?: string } = {};
    let question: string | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const resp = await callModel(apiKey, userContent, attempt === 1);
      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error:", resp.status, t);
        if (resp.status === 429) return json({ error: "Rate limit exceeded. Please try again shortly." }, 429);
        if (resp.status === 402) return json({ error: "AI usage limit reached." }, 402);
        return json({ error: "AI service error" }, 500);
      }
      const data = await resp.json();
      try {
        parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
      } catch {
        parsed = {};
      }
      if (parsed.intervene !== true) break;
      question = sanitiseQuestion(parsed.question, draft);
      if (question) break;
    }

    if (parsed.intervene !== true) {
      await logSuppressed("uncertain");
      return json({ intervene: false, suppressed_reason: "uncertain" });
    }
    if (!question) {
      await logSuppressed("sanitiser_reject", "none");
      return json({ intervene: false, suppressed_reason: "sanitiser_reject" });
    }

    const category = CATEGORIES.includes(parsed.issue_category ?? "") ? parsed.issue_category! : "none";
    const targetParagraph =
      Number.isInteger(parsed.paragraph_index) && (parsed.paragraph_index as number) >= 0
        ? (parsed.paragraph_index as number)
        : paragraphIndex;

    if (shown.some((r) => r.paragraph_index === targetParagraph)) {
      await logSuppressed("budget_paragraph", category);
      return json({ intervene: false, suppressed_reason: "budget_paragraph" });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("coach_interventions")
      .insert({
        essay_id: essayId,
        participant_id: participantId,
        text_stage: textStage,
        word_count: wordCount,
        trigger_event: triggerEvent,
        issue_category: category,
        paragraph_index: targetParagraph,
        question_shown: question,
        snapshot_before_id: snapshotBeforeId,
        intervention_version: INTERVENTION_VERSION,
        system_prompt_version: SYSTEM_PROMPT_VERSION,
        model: MODEL,
        coach_paused: false,
      })
      .select("id")
      .maybeSingle();

    if (insErr || !inserted) {
      console.error("intervention insert failed:", insErr);
      return json({ error: "Could not log intervention" }, 500);
    }

    // Atomic-enough budget counter: recount shown rows and store the total.
    await supabase
      .from("essays")
      .update({ coach_questions_used: shown.length + 1 })
      .eq("id", essayId);

    return json({
      intervene: true,
      intervention_id: inserted.id,
      question,
      issue_category: category,
      paragraph_index: targetParagraph,
      questions_used: shown.length + 1,
      questions_max: MAX_PER_ESSAY,
    });
  } catch (e) {
    console.error("socratic-coach error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
