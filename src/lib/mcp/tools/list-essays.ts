import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_essays",
  title: "List essays",
  description:
    "List the signed-in student's essays with topic, subject, mode, word count, and submission status.",
  inputSchema: {
    mode: z
      .enum(["classroom", "solo", "brainstorm"])
      .optional()
      .describe("Optional filter by writing mode."),
    submitted: z.boolean().optional().describe("Optional filter by submission status."),
    limit: z.number().int().optional().describe("Maximum number of essays to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ mode, submitted, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("essays")
      .select("id, topic, subject, mode, is_submitted, content, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));

    if (mode) query = query.eq("mode", mode);
    if (typeof submitted === "boolean") query = query.eq("is_submitted", submitted);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const essays = (data ?? []).map((row) => ({
      id: row.id,
      topic: row.topic,
      subject: row.subject,
      mode: row.mode,
      submitted: row.is_submitted,
      word_count: String(row.content ?? "").trim().split(/\s+/).filter(Boolean).length,
      updated_at: row.updated_at,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(essays, null, 2) }],
      structuredContent: { essays },
    };
  },
});
