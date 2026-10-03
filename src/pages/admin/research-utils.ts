export const REQUEST_CATEGORIES: Record<string, string> = {
  brainstorming: "Brainstorming or developing ideas",
  claim_thesis: "Clarifying a claim or thesis",
  evidence_finding: "Finding, selecting, or using evidence",
  evidence_explanation: "Explaining how evidence supports a claim",
  organization: "Organizing paragraphs or essay structure",
  counterargument: "Developing a counterargument",
  conclusion: "Writing a conclusion",
  language: "Grammar, wording, or language clarification",
  direct_writing: "Direct request for AI-generated writing",
  other: "Other or uncategorized",
};

export const RESPONSE_TYPES: Record<string, string> = {
  socratic_question: "Socratic question",
  clarifying_question: "Clarifying question",
  evidence_prompt: "Evidence prompt",
  reasoning_prompt: "Reasoning prompt",
  organization_prompt: "Organization prompt",
  counterargument_prompt: "Counterargument prompt",
  conclusion_prompt: "Conclusion prompt",
  boundary_redirection: "Boundary redirection after a direct-writing request",
  technical_fallback: "Technical fallback response",
  other: "Other",
};

export const METHODS_NOTE =
  "One AI interaction was defined as one user-initiated message sent by a participant to the Socratic AI coach. Because participants produced one completed essay rather than separate draft versions, the analytics describe patterns of AI use and characteristics of completed essays; they do not measure changes in writing quality over time.";

export const wordCount = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  return [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n");
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob(["\ufeff" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Render the first SVG inside a container to a PNG data URL (white background). */
export async function svgToPngDataUrl(container: HTMLElement | null): Promise<string | null> {
  const svg = container?.querySelector("svg.recharts-surface") as SVGSVGElement | null;
  if (!svg) return null;
  const { width, height } = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  // Inline computed fills so CSS-variable colours survive serialisation.
  const src = svg.querySelectorAll("*");
  clone.querySelectorAll("*").forEach((el, i) => {
    const cs = getComputedStyle(src[i] as Element);
    (el as SVGElement).setAttribute("fill", cs.fill);
    (el as SVGElement).setAttribute("stroke", cs.stroke);
    (el as SVGElement).style.fontFamily = cs.fontFamily;
    (el as SVGElement).style.fontSize = cs.fontSize;
  });
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/png");
}

export async function downloadPng(name: string, container: HTMLElement | null) {
  const data = await svgToPngDataUrl(container);
  if (!data) return;
  const a = document.createElement("a");
  a.href = data;
  a.download = `${name}.png`;
  a.click();
}
