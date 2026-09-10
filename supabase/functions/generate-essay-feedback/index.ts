import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, enforceRateLimit, jsonResponse, requireUser, sanitizeUserText } from "../_shared/security.ts";
import { rejection, VALIDITY_RULES } from "../_shared/essay-validity.ts";

const MODEL = "google/gemini-3.6-flash";
const PROMPT_VERSION = "v2-validity-2026-09";

const TEACHER_SYSTEM_PROMPT = `You are an AI assistant that prepares a provisional assessment brief for a teacher reviewing an upper-secondary student's argumentative essay.
The student may be writing English as an additional language.
You are not the final grader. Your assessment is only a draft aid for teacher review.

${VALIDITY_RULES}

Assess the essay analytically through:
1. Ideas and reasoning: central claim, quality of reasons, evidence, explanation, qualification, counterargument, and conclusion alignment.
2. Organization: paragraph sequence, logical progression, connections, and conclusion fit.
3. Voice and audience awareness.
4. Word choice and clarity.
5. Sentence fluency.
6. Conventions.

Evaluate ideas and organization independently from grammar and language accuracy.
Do not assume language errors mean weak reasoning.
Do not compare the student to native English speakers.
Do not reward complex vocabulary or long sentences if reasoning is unclear.
Do not give an official grade.
Do not make the AI score the final decision.
Do not invent quotations, evidence, events, revisions, or prompt interactions.
Do not claim the AI caused a revision or improvement.
Do not use insulting, harsh, sarcastic, shaming, or dismissive language.
Do not write a replacement essay, thesis, paragraph, sentence, outline, evidence, citation, example, or source.
Scores are integers 1-6, or null when there is not enough evidence to judge fairly.
Base every statement about AI-coach interaction ONLY on the factual interaction data supplied. If no interaction data is supplied, use "Insufficient data" or "No observable engagement" and say the system cannot infer causation.

Return strict JSON only, of this exact shape:
{"is_valid_essay":true,
"assessment_confidence":"High | Medium | Low",
"ideas_reasoning":{"score":1,"confidence":"High | Medium | Low","rationale":"..."},
"organization":{"score":1,"confidence":"High | Medium | Low","rationale":"..."},
"voice":{"score":1,"confidence":"High | Medium | Low","rationale":"..."},
"word_choice_clarity":{"score":1,"confidence":"High | Medium | Low","rationale":"..."},
"sentence_fluency":{"score":1,"confidence":"High | Medium | Low","rationale":"..."},
"conventions":{"score":1,"confidence":"High | Medium | Low","rationale":"..."},
"strongest_arguments":[{"title":"...","evidence":"...","paragraph_index":1}],
"priority_improvement_areas":[{"title":"...","explanation":"...","paragraph_index":1}],
"possible_teacher_questions":["..."],
"ai_support_label":"No observable engagement | Possible engagement | Evidence of prompt-linked reflection | Insufficient data",
"ai_support_interpretation":"...",
"ai_suggested_revision_type":"surface_level | clarity_revision | organization_revision | meaning_level_revision | no_identifiable_revision | uncertain",
"ai_revision_confidence":"High | Medium | Low"}`;

const STUDENT_SYSTEM_PROMPT = `You are a formative writing-feedback assistant for upper-secondary students, including students who write English as an additional language.
Your role is to help the student reflect on a submitted argumentative essay. You are not a final grader, examiner, proofreader, or ghostwriter.

${VALIDITY_RULES}

Write calm, concise, honest feedback.
Identify one or two strongest arguments or writing moves.
Identify one or two high-value next steps for revision.
End with one concise Socratic revision question.
Focus mainly on claim development, reasoning, evidence explanation, organization, counterargument, conclusion, and clarity for a reader.

Do not give numeric scores, grades, percentages, rankings, pass/fail labels, or trait labels.
Do not say 'weakest part'.
Do not compare the student with native speakers or classmates.
Do not treat grammar errors as weak thinking.
Do not praise, flatter, or overstate. No sycophancy of any kind.
Do not use harsh language.
Do not rewrite the essay.
Do not provide a replacement thesis, paragraph, sentence, outline, evidence, example, citation, source, or direct answer.
Do not list every grammar mistake.
Do not mention AI prompts, coach interaction, writing analytics, or anything about how the essay was typed.
Keep the full feedback between 90 and 130 words.

Return strict JSON only:
{"is_valid_essay":true,"what_is_working_well":["...","..."],"next_step_for_revision":"...","revision_question":"One open-ended Socratic question ending with a question mark."}`;


function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const paragraphs = (s: string) => s.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0).length;

const conf = (v: unknown): string | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "high" ? "High" : s === "medium" ? "Medium" : s === "low" ? "Low" : null;
};
const score = (v: unknown): number | null => {
  const n = typeof v === "number" ? Math.round(v) : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(6, n));
};
const text = (v: unknown, max = 900): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
const strList = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x.trim()).slice(0, max) as string[];

const SUPPORT_LABELS = [
  "No observable engagement",
  "Possible engagement",
  "Evidence of prompt-linked reflection",
  "Insufficient data",
];
const REVISION_TYPES = [
  "surface_level",
  "clarity_revision",
  "organization_revision",
  "meaning_level_revision",
  "no_identifiable_revision",
  "uncertain",
];

async function callModel(system: string, user: string) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error("AI gateway error", resp.status, body);
    const err = new Error(resp.status === 429
      ? "Rate limit exceeded. Please try again shortly."
      : resp.status === 402
      ? "AI usage limit reached."
      : "AI service error") as Error & { status?: number };
    err.status = resp.status === 429 ? 429 : resp.status === 402 ? 402 : 502;
    throw err;
  }
  const data = await resp.json();
  try { return JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { return {}; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const essayId = typeof body?.essay_id === "string" ? body.essay_id : "";
    const requested = ["teacher_assessment", "student_feedback", "both"].includes(body?.output_type)
      ? body.output_type as string
      : "both";
    const force = body?.force === true;
    if (!/^[0-9a-f-]{36}$/i.test(essayId)) return jsonResponse({ error: "Invalid essay id" }, 400);

    const db = admin();

    // ---- Authorisation (server-side, never trust the client) ----
    const { data: essay } = await db
      .from("essays")
      .select("id, student_id, topic, subject, content, is_submitted, classroom_id, assignment_id, mode, duration_minutes, updated_at, research_mode")
      .eq("id", essayId)
      .maybeSingle();
    if (!essay) return jsonResponse({ error: "Essay not found" }, 404);

    const uid = auth.user.id;
    const [{ data: isAdmin }, { data: ownsClassroom }] = await Promise.all([
      db.rpc("is_admin", { _user_id: uid }),
      db.rpc("teacher_owns_essay_classroom", { _essay_id: essayId, _teacher: uid }),
    ]);
    const isStudentAuthor = essay.student_id === uid;
    const isTeacher = ownsClassroom === true;
    if (!isStudentAuthor && !isTeacher && !isAdmin) return jsonResponse({ error: "Forbidden" }, 403);

    // Students may only ever ask for their own student feedback.
    let want = requested;
    if (isStudentAuthor && !isTeacher && !isAdmin) want = "student_feedback";

    if (!essay.is_submitted) return jsonResponse({ error: "Essay is not submitted yet." }, 400);
    if (words(essay.content ?? "") < 20) return jsonResponse({ error: "Essay is too short to review." }, 400);

    const limited = await enforceRateLimit(uid, "generate-essay-feedback");
    if (limited) return limited;

    // ---- Existing records ----
    const [{ data: existingTeacher }, { data: existingStudent }] = await Promise.all([
      db.from("essay_teacher_assessments").select("*").eq("essay_id", essayId).maybeSingle(),
      db.from("essay_student_feedback").select("*").eq("essay_id", essayId).maybeSingle(),
    ]);

    const needTeacher = (want === "teacher_assessment" || want === "both") && (force || !existingTeacher);
    const needStudent = (want === "student_feedback" || want === "both") && (force || !existingStudent);

    if (!needTeacher && !needStudent) {
      return jsonResponse({
        teacher_assessment: want === "student_feedback" ? null : existingTeacher,
        student_feedback: existingStudent,
      });
    }

    // ---- Context ----
    const content = sanitizeUserText(essay.content, 24_000);
    const numbered = content
      .split(/\n{2,}/)
      .map((p, i) => `[Paragraph ${i + 1}] ${p.trim()}`)
      .filter((p) => p.length > 14)
      .join("\n\n") || content;

    let assignmentPrompt = "";
    if (essay.assignment_id) {
      const { data: a } = await db.from("assignments").select("title, prompt, instructions").eq("id", essay.assignment_id).maybeSingle();
      if (a) assignmentPrompt = [a.title, a.prompt, a.instructions].filter(Boolean).join("\n").slice(0, 2000);
    }

    let processBlock = "No reliable writing-process data recorded.";
    let durationSeconds: number | null = null;
    let revisions: number | null = null;
    let submittedAt: string | null = essay.updated_at ?? null;

    const { data: events } = await db
      .from("writing_events")
      .select("at, word_count, chars_added, is_paste")
      .eq("essay_id", essayId)
      .order("at");
    if (events && events.length > 1) {
      const first = new Date(events[0].at).getTime();
      const last = new Date(events[events.length - 1].at).getTime();
      durationSeconds = Math.max(0, Math.round((last - first) / 1000));
      // A "meaningful revision" = a recorded snapshot whose net change is at
      // least 25 characters (additions or deletions), i.e. more than a typo fix.
      revisions = events.filter((e) => Math.abs(e.chars_added ?? 0) >= 25).length;
      const pastes = events.filter((e) => e.is_paste).length;
      processBlock = `Snapshots recorded: ${events.length}. Approx. writing duration: ${Math.round(durationSeconds / 60)} min. Meaningful revisions (>=25 chars changed): ${revisions}. Paste events recorded: ${pastes}.`;
    } else if (essay.duration_minutes) {
      durationSeconds = essay.duration_minutes * 60;
      processBlock = `Approx. writing duration: ${essay.duration_minutes} min. No snapshot data.`;
    }

    // Coach interaction (factual counts only; no participant codes to the model).
    let shown: number | null = null, answered: number | null = null, skipped: number | null = null,
      notNow: number | null = null, paused: boolean | null = null;
    let topics: string[] = [];
    let interactionBlock = "No AI coach interaction data recorded for this essay.";
    const { data: interventions } = await db
      .from("coach_interventions")
      .select("issue_category, user_action, coach_paused, word_count, reflection_response, target_paragraph_changed, revision_type")
      .eq("essay_id", essayId);
    if (interventions && interventions.length > 0) {
      shown = interventions.length;
      answered = interventions.filter((i) => i.user_action === "answered").length;
      skipped = interventions.filter((i) => i.user_action === "skipped").length;
      notNow = interventions.filter((i) => i.user_action === "not_now").length;
      paused = interventions.some((i) => i.coach_paused === true);
      topics = [...new Set(interventions.map((i) => i.issue_category).filter(Boolean))].slice(0, 8) as string[];
      const reflected = interventions.filter((i) => (i.reflection_response ?? "").trim().length > 0).length;
      const linkedChange = interventions.filter((i) => i.target_paragraph_changed === true).length;
      interactionBlock = `Questions shown: ${shown}. Answered: ${answered}. Skipped: ${skipped}. Marked "not now": ${notNow}. Coach paused at some point: ${paused}. Prompt topics: ${topics.join(", ") || "none"}. Written reflections recorded: ${reflected}. Prompts followed by a recorded change in the targeted paragraph: ${linkedChange}.`;
    } else {
      const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("essay_id", essayId);
      if ((count ?? 0) > 0) interactionBlock = `No proactive coach prompts were recorded. The student exchanged ${count} messages with the reactive AI tutor. Treat prompt-linked reflection as "Insufficient data".`;
    }

    const finalWords = words(content);
    const paraCount = paragraphs(content);

    const out: Record<string, unknown> = { teacher_assessment: null, student_feedback: null };
    const errors: string[] = [];

    if (needTeacher) {
      try {
        const parsed = await callModel(
          TEACHER_SYSTEM_PROMPT,
          `ASSIGNMENT: ${sanitizeUserText(assignmentPrompt, 2000) || essay.topic || "(none)"}
SUBJECT: ${essay.subject}
WORD COUNT: ${finalWords} | PARAGRAPHS: ${paraCount}
WRITING PROCESS DATA: ${processBlock}
AI COACH INTERACTION DATA: ${interactionBlock}

ESSAY:
${numbered}`,
        );
        const trait = (k: string) => {
          const t = (parsed?.[k] ?? {}) as Record<string, unknown>;
          return { score: score(t.score), confidence: conf(t.confidence), rationale: text(t.rationale, 600) };
        };
        const ideas = trait("ideas_reasoning"), org = trait("organization"), voice = trait("voice");
        const wcc = trait("word_choice_clarity"), flu = trait("sentence_fluency"), conv = trait("conventions");
        const label = SUPPORT_LABELS.includes(String(parsed?.ai_support_label)) ? String(parsed.ai_support_label) : "Insufficient data";
        const revType = REVISION_TYPES.includes(String(parsed?.ai_suggested_revision_type)) ? String(parsed.ai_suggested_revision_type) : "uncertain";

        const row = {
          essay_id: essayId,
          generated_at: new Date().toISOString(),
          model_version: MODEL,
          prompt_version: PROMPT_VERSION,
          assessment_confidence: conf(parsed?.assessment_confidence) ?? "Low",
          ideas_reasoning_score: ideas.score, ideas_reasoning_confidence: ideas.confidence, ideas_reasoning_rationale: ideas.rationale,
          organization_score: org.score, organization_confidence: org.confidence, organization_rationale: org.rationale,
          voice_score: voice.score, voice_confidence: voice.confidence, voice_rationale: voice.rationale,
          word_choice_clarity_score: wcc.score, word_choice_clarity_confidence: wcc.confidence, word_choice_clarity_rationale: wcc.rationale,
          sentence_fluency_score: flu.score, sentence_fluency_confidence: flu.confidence, sentence_fluency_rationale: flu.rationale,
          conventions_score: conv.score, conventions_confidence: conv.confidence, conventions_rationale: conv.rationale,
          strongest_arguments: list(parsed?.strongest_arguments, 3),
          priority_improvement_areas: list(parsed?.priority_improvement_areas, 3),
          possible_teacher_questions: strList(parsed?.possible_teacher_questions, 3),
          writing_duration_seconds: durationSeconds,
          final_word_count: finalWords,
          paragraph_count: paraCount,
          meaningful_revision_count: revisions,
          submitted_at: submittedAt,
          ai_questions_shown: shown, ai_questions_answered: answered,
          ai_questions_skipped: skipped, ai_questions_not_now: notNow,
          ai_coach_paused: paused,
          ai_prompt_topics: topics,
          ai_support_label: label,
          ai_support_interpretation: text(parsed?.ai_support_interpretation, 800),
          ai_suggested_revision_type: revType,
          ai_revision_confidence: conf(parsed?.ai_revision_confidence) ?? "Low",
          updated_at: new Date().toISOString(),
        };
        const { data: saved } = await db.from("essay_teacher_assessments")
          .upsert(row, { onConflict: "essay_id" }).select("*").maybeSingle();
        out.teacher_assessment = saved ?? row;
      } catch (e) {
        console.error("teacher assessment failed", e);
        errors.push("teacher_assessment");
        out.teacher_assessment = existingTeacher ?? null;
      }
    } else if (want !== "student_feedback") {
      out.teacher_assessment = existingTeacher;
    }

    if (needStudent) {
      try {
        const parsed = await callModel(
          STUDENT_SYSTEM_PROMPT,
          `ASSIGNMENT: ${sanitizeUserText(assignmentPrompt, 2000) || essay.topic || "(none)"}

ESSAY:
${numbered}`,
        );
        const working = strList(parsed?.what_is_working_well, 2);
        const next = text(parsed?.next_step_for_revision, 600);
        let question = text(parsed?.revision_question, 300);
        if (question && !question.includes("?")) question = `${question.replace(/[.!]+$/, "")}?`;
        const row = {
          essay_id: essayId,
          student_id: essay.student_id,
          generated_at: new Date().toISOString(),
          model_version: MODEL,
          prompt_version: PROMPT_VERSION,
          what_is_working_well: working,
          next_step_for_revision: next,
          revision_question: question,
          feedback_text: [working.join(" "), next, question].filter(Boolean).join("\n\n"),
          updated_at: new Date().toISOString(),
        };
        const { data: saved } = await db.from("essay_student_feedback")
          .upsert(row, { onConflict: "essay_id" }).select("*").maybeSingle();
        out.student_feedback = saved ?? row;
      } catch (e) {
        console.error("student feedback failed", e);
        errors.push("student_feedback");
        out.student_feedback = existingStudent ?? null;
      }
    } else {
      out.student_feedback = existingStudent;
    }

    // A student must never receive teacher-only assessment content.
    if (isStudentAuthor && !isTeacher && !isAdmin) out.teacher_assessment = null;
    if (errors.length) out.errors = errors;

    return jsonResponse(out);
  } catch (e) {
    console.error("generate-essay-feedback error:", e);
    const status = (e as { status?: number })?.status ?? 500;
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, status);
  }
});
