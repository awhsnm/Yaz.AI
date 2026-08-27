import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_essay",
  title: "Get essay",
  description:
    "Read one of the signed-in student's essays: full text, topic, subject, mode, status, and AI evaluation when available.",
  inputSchema: {
    essay_id: z.string().describe("The essay id returned by list_essays."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ essay_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("essays")
      .select(
        "id, topic, subject, mode, content, is_submitted, ai_evaluation, ai_feedback, topic_brief, created_at, updated_at",
      )
      .eq("id", essay_id)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return { content: [{ type: "text", text: "Essay not found or not accessible." }], isError: true };
    }

    const essay = {
      ...data,
      word_count: String(data.content ?? "").trim().split(/\s+/).filter(Boolean).length,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(essay, null, 2) }],
      structuredContent: { essay },
    };
  },
});
