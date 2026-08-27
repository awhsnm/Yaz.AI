import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEssaysTool from "./tools/list-essays";
import getEssayTool from "./tools/get-essay";
import createEssayTool from "./tools/create-essay";
import saveDraftTool from "./tools/save-draft";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "yaz-ai",
  title: "Yaz.AI",
  version: "0.1.0",
  instructions:
    "Tools for Yaz.AI, a Socratic writing platform for high school students. Use `list_essays` and `get_essay` to read the signed-in student's essays, `create_essay` to start a personal practice essay, and `save_draft` to update an unsubmitted personal draft. Classroom essays are read-only here; they must be written in the app's locked writing environment. Never write essay text on the student's behalf unless they explicitly ask for their own drafted text to be saved.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEssaysTool, getEssayTool, createEssayTool, saveDraftTool],
});
