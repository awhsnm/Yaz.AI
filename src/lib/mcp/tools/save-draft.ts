import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "save_draft",
  title: "Save essay draft",
  description:
    "Replace the text of one of the signed-in student's own unsubmitted personal practice essays (solo or brainstorm). Classroom and submitted essays cannot be edited here.",
  inputSchema: {
    essay_id: z.string().describe("The essay id returned by list_essays."),
    content: z.string().describe("Full replacement draft text."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ essay_id, content }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data: essay, error: readError } = await supabase
      .from("essays")
      .select("id, mode, is_submitted, classroom_id")
      .eq("id", essay_id)
      .maybeSingle();

    if (readError) return { content: [{ type: "text", text: readError.message }], isError: true };
    if (!essay) {
      return { content: [{ type: "text", text: "Essay not found or not accessible." }], isError: true };
    }
    if (essay.is_submitted) {
      return { content: [{ type: "text", text: "This essay is submitted and locked." }], isError: true };
    }
    if (essay.classroom_id || essay.mode === "classroom") {
      return {
        content: [{ type: "text", text: "Classroom essays can only be edited in the app's writing environment." }],
        isError: true,
      };
    }

    const { error } = await supabase
      .from("essays")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", essay_id);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return {
      content: [{ type: "text", text: `Draft saved (${words} words).` }],
      structuredContent: { essay_id, word_count: words },
    };
  },
});
