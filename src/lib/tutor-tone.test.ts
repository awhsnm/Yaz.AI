import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildOpeningQuestion,
  findToneViolations,
  violatesTone,
  TONE_FORBIDDEN_PATTERNS,
} from "./tutor-tone";

const readRepoFile = (relative: string) =>
  readFileSync(resolve(process.cwd(), relative), "utf8");

describe("tone rule detection", () => {
  it("flags greetings and self-introductions", () => {
    expect(findToneViolations("Welcome! I'm your AI writing tutor.")).toContain("greeting");
    expect(findToneViolations("Hello there, let's get started")).toContain("greeting");
  });

  it("flags emojis", () => {
    expect(findToneViolations("Nice idea 💡")).toContain("emoji");
    expect(findToneViolations("Ready? 🚀")).toContain("emoji");
    expect(findToneViolations("Plain ASCII text — with a dash")).not.toContain("emoji");
  });

  it("flags capability menus", () => {
    expect(findToneViolations("You can ask me about structure.")).toContain("menu");
    expect(findToneViolations("How would you like to start?")).toContain("menu");
  });

  it("flags automatic praise", () => {
    expect(findToneViolations("Great question! It's a timely topic.")).toContain("praise");
    expect(findToneViolations("It's great that you're starting early.")).toContain("praise");
  });

  it("flags filler phrasing", () => {
    expect(findToneViolations("Before we jump into the thesis, some context.")).toContain("filler");
    expect(findToneViolations("As an AI, I'm here to help.")).toContain("filler");
  });

  it("does not flag a plain analytical question", () => {
    expect(
      violatesTone("What specific claim will your essay make about mindful rest and productivity?"),
    ).toBe(false);
  });

  it("exposes one pattern per banned category", () => {
    expect(TONE_FORBIDDEN_PATTERNS.map((r) => r.id).sort()).toEqual([
      "emoji",
      "filler",
      "greeting",
      "menu",
      "praise",
    ]);
  });
});

describe("tutor opening message", () => {
  const cases: Array<[string, string]> = [
    ["Why High School Students Need Mindful Rest to Achieve True Productivity", "Literature"],
    ["Social media and teenage attention spans", "English"],
    ["Should schools ban homework?", ""],
  ];

  it.each(cases)("opens with a clean direct question for %s", (topic, subject) => {
    const opening = buildOpeningQuestion(topic, subject);
    expect(findToneViolations(opening)).toEqual([]);
    expect(opening.startsWith("What specific claim will your essay make about")).toBe(true);
    expect(opening.trim().endsWith("?")).toBe(true);
  });

  it("is a single sentence with no preamble or bullet menu", () => {
    const opening = buildOpeningQuestion("Mindful rest and productivity");
    expect(opening).not.toMatch(/\n/);
    expect(opening).not.toMatch(/[•\-*]\s/);
    expect(opening.split("?").filter(Boolean)).toHaveLength(1);
  });
});

describe("system prompts enforce the tone contract", () => {
  const promptFiles = [
    "supabase/functions/ai-tutor/index.ts",
    "supabase/functions/socratic-coach/index.ts",
  ];

  it.each(promptFiles)("%s contains no greetings, emojis, menus, praise, or filler", (file) => {
    const source = readRepoFile(file);
    const match = source.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
    expect(match, `SYSTEM_PROMPT not found in ${file}`).toBeTruthy();
    const prompt = match![1];
    // The prompt may *name* banned phrasing inside its ban list; strip quoted
    // examples before checking that the prompt itself is clean.
    const withoutQuotedExamples = prompt.replace(/"[^"]*"/g, "");
    expect(findToneViolations(withoutQuotedExamples)).toEqual([]);
  });

  it.each(promptFiles)("%s explicitly bans the four tone categories", (file) => {
    const prompt = readRepoFile(file);
    expect(prompt).toMatch(/emoji/i);
    expect(prompt).toMatch(/greeting/i);
    expect(prompt).toMatch(/prais|compliment/i);
    expect(prompt).toMatch(/menu|list of (things|options)|filler/i);
  });
});

describe("AITutorSidebar hard-coded copy", () => {
  it("uses the shared opening builder instead of a chatty welcome string", () => {
    const source = readRepoFile("src/components/AITutorSidebar.tsx");
    expect(source).toMatch(/buildOpeningQuestion/);
    expect(source).not.toMatch(/Welcome! I'm your AI writing tutor/);
    expect(findToneViolations(source.match(/content: (`[^`]*`|buildOpeningQuestion\([^)]*\))/)?.[1] ?? "")).toEqual([]);
  });
});
