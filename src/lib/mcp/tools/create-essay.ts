import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_essay",
  title: "Create practice essay",
  description:
    "Create a new personal practice essay (solo or brainstorm mode) for the signed-in student. Classroom essays must be started in the app with a lesson code.",
  inputSchema: {
    topic: z.string().describe("Essay topic or prompt."),
    subject: z
      .string()
      .describe("Subject: English, Russian Literature, Kazakh Literature, or General."),
    mode: z
      .enum(["solo", "brainstorm"])
      .optional()
      .describe("Writing mode; defaults to solo practice."),
    duration_minutes: z
      .number()
      .int()
      .optional()
      .describe("Timer length for solo practice in minutes (default 45)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ topic, subject, mode, duration_minutes }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      return { content: [{ type: "text", text: "Topic must not be empty." }], isError: true };
    }

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("essays")
      .insert({
        student_id: ctx.getUserId(),
        topic: trimmedTopic,
        subject: subject.trim() || "General",
        mode: mode ?? "solo",
        classroom_id: null,
        content: "",
        duration_minutes: mode === "brainstorm" ? null : Math.min(Math.max(duration_minutes ?? 45, 5), 180),
      })
      .select("id, topic, subject, mode")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [
        { type: "text", text: `Created essay ${data?.id} — open it in the app at /essay/${data?.id}` },
      ],
      structuredContent: { essay: data },
    };
  },
});
