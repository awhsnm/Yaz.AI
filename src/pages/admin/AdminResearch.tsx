import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Image as ImageIcon, RefreshCw, Sparkles, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  METHODS_NOTE, REQUEST_CATEGORIES, RESPONSE_TYPES, downloadCsv, downloadPng, median, svgToPngDataUrl, wordCount,
} from "./research-utils";

type Participant = { user_id: string; participant_code: string; study_cohort_id: string | null; consent_status: string; included: boolean; created_at: string };
type Cohort = { id: string; name: string };
type Essay = { id: string; student_id: string; topic: string | null; content: string | null; is_submitted: boolean; created_at: string; submitted_at: string | null; assignment_id: string | null };
type Interaction = { id: string; student_id: string; essay_id: string; student_message: string; ai_response: string | null; created_at: string };
type Review = {
  interaction_id: string; auto_request_category: string | null; final_request_category: string | null;
  is_direct_writing_request: boolean | null; auto_response_type: string | null; final_response_type: string | null;
  is_socratic_response: boolean | null; is_boundary_redirection: boolean | null; ai_wrote_ready_text: boolean | null; ai_provided_wording: boolean | null;
  review_status: string; reviewer_notes: string | null; reviewed_by: string | null; reviewed_at: string | null;
};
type Coding = {
  essay_id: string; clear_claim: number | null; relevant_evidence: number | null; evidence_explanation: number | null;
  counterargument: number | null; organization: number | null; notes: string | null; coded_by: string | null; coded_at: string | null;
};

const CODING_FIELDS: [keyof Coding, string][] = [
  ["clear_claim", "Clear claim"],
  ["relevant_evidence", "Relevant evidence"],
  ["evidence_explanation", "Evidence-to-claim explanation"],
  ["counterargument", "Counterargument or qualification"],
  ["organization", "Organization"],
];

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)(table).select(select).range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : "");
const yn = (b: boolean | null | undefined) => (b == null ? "" : b ? "Yes" : "No");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const sel = "h-8 rounded-md border border-input bg-background px-2 text-xs";

const Section = ({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
      <CardTitle className="text-base font-display">{title}</CardTitle>
      <div className="flex gap-2 flex-wrap">{actions}</div>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

const Pager = ({ page, total, size, onChange }: { page: number; total: number; size: number; onChange: (p: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      <span>{total} rows · page {page + 1} of {pages}</span>
      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onChange(page - 1)}>Prev</Button>
      <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}>Next</Button>
    </div>
  );
};

const Th = ({ children }: { children: React.ReactNode }) => <th className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{children}</th>;
const Td = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
  <td className={`px-2 py-2 align-top ${wide ? "min-w-[240px] max-w-[360px]" : "whitespace-nowrap"}`}>{children}</td>
);
const Clip = ({ text }: { text: string | null }) => <div className="line-clamp-4 whitespace-pre-wrap" title={text ?? ""}>{text}</div>;

export default function AdminResearch() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [coding, setCoding] = useState<Record<string, Coding>>({});
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [classifying, setClassifying] = useState(false);

  // filters
  const [cohort, setCohort] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [topic, setTopic] = useState("all");
  const [pSearch, setPSearch] = useState("");

  const [showManage, setShowManage] = useState(false);
  const [newCohort, setNewCohort] = useState("");
  const [pendingExport, setPendingExport] = useState<null | (() => void)>(null);
  const [msgPage, setMsgPage] = useState(0);
  const [respPage, setRespPage] = useState(0);
  const [auditOnlyDirect, setAuditOnlyDirect] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "unreviewed" | "verified" | "corrected">("all");
  const [otherQueue, setOtherQueue] = useState(false);
  const [otherRespQueue, setOtherRespQueue] = useState(false);
  const [anonTopics, setAnonTopics] = useState(true);
  const [admins, setAdmins] = useState<Set<string>>(new Set());

  const fig1 = useRef<HTMLDivElement>(null);
  const fig2 = useRef<HTMLDivElement>(null);
  const fig3 = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, e, i, r, cd, a] = await Promise.all([
        fetchAll<Participant>("study_participants", "*"),
        fetchAll<Cohort>("study_cohorts", "id,name"),
        fetchAll<Essay>("essays", "id,student_id,topic,content,is_submitted,created_at,submitted_at,assignment_id"),
        fetchAll<Interaction>("ai_interactions", "id,student_id,essay_id,student_message,ai_response,created_at"),
        fetchAll<Review>("research_message_reviews", "*"),
        fetchAll<Coding>("research_essay_coding", "*"),
        fetchAll<{ id: string; title: string }>("assignments", "id,title"),
      ]);
      setParticipants(p.sort((x, y) => x.participant_code.localeCompare(y.participant_code, undefined, { numeric: true })));
      setCohorts(c);
      setEssays(e);
      setInteractions(i.sort((x, y) => x.created_at.localeCompare(y.created_at)));
      setReviews(Object.fromEntries(r.map((x) => [x.interaction_id, x])));
      setCoding(Object.fromEntries(cd.map((x) => [x.essay_id, x])));
      setAssignments(Object.fromEntries(a.map((x) => [x.id, x.title])));
      try {
        const roles = await fetchAll<{ user_id: string; role: string }>("user_roles", "user_id,role");
        setAdmins(new Set(roles.filter((x) => x.role === "admin").map((x) => x.user_id)));
      } catch { /* roles not readable: no admin exclusion */ }
    } catch (err) {
      toast.error("Could not load research data");
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const essayTopic = useCallback((e?: Essay) => (e ? (e.assignment_id && assignments[e.assignment_id]) || e.topic || "(untitled)" : ""), [assignments]);

  // ---------- filtering ----------
  const inRange = useCallback((iso: string) => {
    if (from && iso < from) return false;
    if (to && iso.slice(0, 10) > to) return false;
    return true;
  }, [from, to]);

  const selParticipants = useMemo(() => participants.filter((p) =>
    p.included && !admins.has(p.user_id) &&
    (cohort === "all" || p.study_cohort_id === cohort) &&
    (!pSearch || p.participant_code.toLowerCase().includes(pSearch.toLowerCase())),
  ), [participants, cohort, pSearch, admins]);
  const pByUser = useMemo(() => Object.fromEntries(selParticipants.map((p) => [p.user_id, p])), [selParticipants]);

  const selEssays = useMemo(() => essays.filter((e) =>
    pByUser[e.student_id] && inRange(e.created_at) && (topic === "all" || essayTopic(e) === topic),
  ), [essays, pByUser, inRange, topic, essayTopic]);
  const essayIds = useMemo(() => new Set(selEssays.map((e) => e.id)), [selEssays]);
  const essayById = useMemo(() => Object.fromEntries(essays.map((e) => [e.id, e])), [essays]);

  const selInteractions = useMemo(() => interactions.filter((i) => essayIds.has(i.essay_id) && inRange(i.created_at)), [interactions, essayIds, inRange]);

  const topics = useMemo(() => [...new Set(essays.filter((e) => participants.some((p) => p.user_id === e.student_id)).map(essayTopic))].sort(), [essays, participants, essayTopic]);

  // ---------- per participant ----------
  const perParticipant = useMemo(() => {
    const started = new Set(selEssays.map((e) => e.student_id));
    return selParticipants.filter((p) => started.has(p.user_id)).map((p) => {
      const mine = selEssays.filter((e) => e.student_id === p.user_id);
      const primary = [...mine].sort((a, b) =>
        Number(b.is_submitted) - Number(a.is_submitted) || (b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at))[0];
      const msgs = selInteractions.filter((i) => i.student_id === p.user_id);
      const direct = msgs.filter((m) => reviews[m.id]?.is_direct_writing_request);
      const redirected = direct.filter((m) => reviews[m.id]?.is_boundary_redirection);
      const reviewed = msgs.filter((m) => reviews[m.id] && reviews[m.id].review_status !== "unreviewed").length;
      return {
        p, primary, msgs: msgs.length, responses: msgs.filter((m) => m.ai_response).length,
        direct: direct.length, redirected: redirected.length,
        completed: mine.some((e) => e.is_submitted),
        reviewStatus: !msgs.length ? "n/a" : reviewed === msgs.length ? "reviewed" : reviewed ? "in progress" : "unreviewed",
      };
    });
  }, [selParticipants, selEssays, selInteractions, reviews]);

  const isVerified = (id: string) => !!reviews[id] && reviews[id].review_status !== "unreviewed";
  const statusOf = (id: string) => (reviews[id]?.review_status ?? "unreviewed");
  const passStatus = (st: string) => statusFilter === "all" || (statusFilter === "verified" ? st === "reviewed" : st === statusFilter);
  const verifiedCat = (id: string) => (isVerified(id) ? reviews[id]?.final_request_category ?? null : null);
  const verifiedType = (id: string) => (isVerified(id) ? reviews[id]?.final_response_type ?? null : null);
  const shownCat = (id: string) => reviews[id]?.final_request_category ?? reviews[id]?.auto_request_category ?? null;
  const shownType = (id: string) => reviews[id]?.final_response_type ?? reviews[id]?.auto_response_type ?? null;

  const stats = useMemo(() => {
    const counts = perParticipant.map((x) => x.msgs);
    const users = perParticipant.filter((x) => x.msgs > 0);
    const completedP = perParticipant.filter((x) => x.completed);
    const flagged = selInteractions.filter((i) => reviews[i.id]?.is_direct_writing_request);
    const flaggedUnverified = flagged.filter((i) => !isVerified(i.id)).length;
    const direct = flagged.filter((i) => isVerified(i.id));
    const redirected = direct.filter((i) => reviews[i.id]?.is_boundary_redirection);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return {
      started: perParticipant.length,
      completed: completedP.length,
      // one unique completed essay per completed participant (their latest submitted one)
      essaysAnalyzed: new Set(completedP.map((x) => x.primary?.id).filter(Boolean)).size,
      rawSubmitted: selEssays.filter((e) => e.is_submitted).length,
      used: users.length,
      startedNotUsed: perParticipant.filter((x) => x.msgs === 0).length,
      completedNotUsed: completedP.filter((x) => x.msgs === 0).length,
      messages: selInteractions.length,
      responses: selInteractions.filter((i) => i.ai_response).length,
      mean: counts.length ? r2(counts.reduce((a, b) => a + b, 0) / counts.length) : 0,
      meanUsers: users.length ? r2(users.reduce((a, b) => a + b.msgs, 0) / users.length) : 0,
      median: median(counts),
      min: counts.length ? Math.min(...counts) : 0,
      max: counts.length ? Math.max(...counts) : 0,
      flaggedUnverified,
      direct: direct.length,
      redirected: redirected.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perParticipant, selInteractions, selEssays, reviews]);

  const directReady = stats.flaggedUnverified === 0;
  const directText = directReady ? String(stats.direct) : `Pending verification (${stats.flaggedUnverified} flagged unreviewed)`;
  const redirText = directReady ? `${stats.redirected} of ${stats.direct} (${pct(stats.redirected, stats.direct)}%)` : "Pending verification";
  const of = (n: number, d: number, label: string) => `${n} of ${d} ${label} (${pct(n, d)}%)`;

  const table1 = [
    ["Participants who started the writing activity", stats.started],
    ["Participants who completed the writing activity", of(stats.completed, stats.started, "started")],
    ["Completed essays analyzed (one per completed participant)", stats.essaysAnalyzed],
    ["Participants who used the AI coach at least once", of(stats.used, stats.started, "started")],
    ["Started participants who did not use the AI coach", of(stats.startedNotUsed, stats.started, "started")],
    ["Completed participants who did not use the AI coach", of(stats.completedNotUsed, stats.completed, "completed")],
    ["Total student-initiated AI messages", stats.messages],
    ["Mean student AI messages per participant who started", `${stats.mean} (n = ${stats.started})`],
    ["Mean student AI messages among AI users", `${stats.meanUsers} (n = ${stats.used})`],
    ["Median student AI messages per participant who started", `${stats.median} (n = ${stats.started})`],
    ["Range of student AI messages per participant who started", `${stats.min}–${stats.max}`],
    ["Total AI-generated responses", stats.responses],
    ...(directReady ? [
      ["Direct-writing requests (verified)", directText],
      ["Socratic redirections of verified direct-writing requests", redirText],
    ] as const : []),
  ] as const;

  const fig1Data = [...perParticipant].sort((a, b) => b.msgs - a.msgs).map((x) => ({
    id: x.p.participant_code, messages: x.msgs, responses: x.responses,
    status: x.completed ? "Completed" : "Started", words: wordCount(x.primary?.content), direct: x.direct,
  }));

  const msgsUnreviewed = selInteractions.filter((i) => !isVerified(i.id)).length;
  const respUnreviewed = selInteractions.filter((i) => i.ai_response && !isVerified(i.id)).length;
  const catsReady = msgsUnreviewed === 0;
  const typesReady = respUnreviewed === 0;

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    selInteractions.forEach((i) => { const c = verifiedCat(i.id); if (c) m[c] = (m[c] ?? 0) + 1; });
    const total = Object.values(m).reduce((a, b) => a + b, 0);
    return Object.entries(REQUEST_CATEGORIES).map(([k, label]) => ({ key: k, label, count: m[k] ?? 0, pct: pct(m[k] ?? 0, total) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selInteractions, reviews]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    selInteractions.filter((i) => i.ai_response).forEach((i) => { const t = verifiedType(i.id); if (t) m[t] = (m[t] ?? 0) + 1; });
    const total = Object.values(m).reduce((a, b) => a + b, 0);
    return Object.entries(RESPONSE_TYPES).map(([k, label]) => ({ key: k, label, count: m[k] ?? 0, pct: pct(m[k] ?? 0, total) })).filter((x) => x.count > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selInteractions, reviews]);

  const unclassified = selInteractions.filter((i) => !reviews[i.id]?.auto_request_category && !reviews[i.id]?.final_request_category).length;

  // anonymised / truncated topics for paper-ready outputs
  const topicCode = useMemo(() => Object.fromEntries(topics.map((t, idx) => [t, `T${idx + 1}`])), [topics]);
  const safeTopic = (e?: Essay) => {
    const t = essayTopic(e);
    if (!t) return "";
    if (anonTopics) return topicCode[t] ?? "T?";
    return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  };

  // ---------- actions ----------
  const pcode = (uid: string) => participants.find((p) => p.user_id === uid)?.participant_code ?? "";

  const assignIds = async () => {
    const { data, error } = await supabase.rpc("assign_study_participants");
    if (error) return toast.error("Could not assign participant IDs");
    toast.success(`${data ?? 0} participant ID(s) assigned`);
    load();
  };

  const updateParticipant = async (uid: string, patch: Partial<Participant>) => {
    setParticipants((ps) => ps.map((p) => (p.user_id === uid ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("study_participants").update(patch).eq("user_id", uid);
    if (error) toast.error("Could not save");
  };

  const addCohort = async () => {
    if (!newCohort.trim()) return;
    const { error } = await supabase.from("study_cohorts").insert({ name: newCohort.trim() });
    if (error) return toast.error("Could not create cohort");
    setNewCohort("");
    load();
  };

  const runClassify = async () => {
    setClassifying(true);
    try {
      for (let round = 0; round < 15; round++) {
        const { data, error } = await supabase.functions.invoke("research-classify");
        if (error) throw error;
        if (!data?.classified || !data?.remaining) break;
      }
      toast.success("Automatic labels updated");
      await load();
    } catch {
      toast.error("Automatic labelling failed");
    }
    setClassifying(false);
  };

  const saveReview = async (id: string, patch: Partial<Review>) => {
    const prev = reviews[id] ?? ({ interaction_id: id, review_status: "unreviewed" } as Review);
    const next = { ...prev, ...patch };
    const changed =
      (next.final_request_category ?? null) !== (next.auto_request_category ?? null) ||
      (next.final_response_type ?? null) !== (next.auto_response_type ?? null);
    const row = {
      ...next, review_status: changed ? "corrected" : "reviewed",
      reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setReviews((r) => ({ ...r, [id]: row }));
    const { error } = await supabase.from("research_message_reviews").upsert(row);
    if (error) toast.error("Could not save review");
  };

  const saveCoding = async (essayId: string, patch: Partial<Coding>) => {
    const row = { ...(coding[essayId] ?? { essay_id: essayId }), ...patch, coded_by: user?.id ?? null, coded_at: new Date().toISOString() } as Coding;
    setCoding((c) => ({ ...c, [essayId]: row }));
    const { error } = await supabase.from("research_essay_coding").upsert(row);
    if (error) toast.error("Could not save coding");
  };

  const reviewer = (uid: string | null) => (uid ? (uid === user?.id ? "You" : "Admin") : "");

  // ---------- export rows ----------
  const table1Rows = () => table1.map(([m, r]) => ({ Measure: m, Result: r }));
  const participantRows = () => perParticipant.map((x) => ({
    "Participant ID": x.p.participant_code, "Essay topic or assignment": safeTopic(x.primary),
    "Essay status": x.completed ? "submitted" : "started", "Essay word count": wordCount(x.primary?.content),
    "Started at": x.primary?.created_at ?? "", "Completed at": x.primary?.submitted_at ?? "",
    "Number of student AI messages": x.msgs, "Number of AI responses": x.responses,
    "Number of direct-writing requests": x.direct, "Number of Socratic redirections": x.redirected,
    "Research review status": x.reviewStatus,
  }));
  const messageRows = () => selInteractions.map((i) => {
    const r = reviews[i.id];
    return {
      "Participant ID": pcode(i.student_id), "Created at": i.created_at,
      "Student message text": i.student_message,
      "Auto-detected request category": REQUEST_CATEGORIES[r?.auto_request_category ?? ""] ?? "",
      "Final verified request category": REQUEST_CATEGORIES[r?.final_request_category ?? ""] ?? "",
      "Direct-writing request detected": yn(r?.is_direct_writing_request), "Review status": r?.review_status ?? "unreviewed",
      "Reviewed at": r?.reviewed_at ?? "",
    };
  });
  const responseRows = () => selInteractions.filter((i) => i.ai_response).map((i) => {
    const r = reviews[i.id];
    return {
      "Participant ID": pcode(i.student_id),
      "Student request text": i.student_message, "AI response text": i.ai_response,
      "Auto-detected response type": RESPONSE_TYPES[r?.auto_response_type ?? ""] ?? "",
      "Final verified response type": RESPONSE_TYPES[r?.final_response_type ?? ""] ?? "",
      "Socratic response": yn(r?.is_socratic_response), "Boundary redirection": yn(r?.is_boundary_redirection),
      "AI provided direct wording or translation": yn(r?.ai_provided_wording),
      "Review status": r?.review_status ?? "unreviewed", "Reviewed at": r?.reviewed_at ?? "",
    };
  });
  const auditList = selInteractions.filter((i) => (!auditOnlyDirect || reviews[i.id]?.is_direct_writing_request) && passStatus(statusOf(i.id)));
  const auditRows = () => auditList.map((i) => {
    const r = reviews[i.id];
    return {
      "Participant ID": pcode(i.student_id), "Date and time": i.created_at,
      "Student request text": i.student_message, "AI response text": i.ai_response ?? "",
      "Direct-writing request": yn(r?.is_direct_writing_request), "AI provided direct wording or translation": yn(r?.ai_provided_wording),
      "AI wrote ready-to-submit text": yn(r?.ai_wrote_ready_text),
      "AI used Socratic redirection": yn(r?.is_boundary_redirection), "Researcher review status": r?.review_status ?? "unreviewed",
      "Reviewer notes": r?.reviewer_notes ?? "",
    };
  });
  const codingStatus = (id: string) => { const c = coding[id]; const n = CODING_FIELDS.filter(([k]) => typeof c?.[k] === "number").length; return n === CODING_FIELDS.length ? "reviewed" : "unreviewed"; };
  const allCoded = perParticipant.filter((x) => x.completed && x.primary).map((x) => ({ x, e: x.primary! }));
  const codingUncoded = allCoded.filter(({ e }) => codingStatus(e.id) !== "reviewed").length;
  const codedEssays = allCoded.filter(({ e }) => passStatus(codingStatus(e.id)));
  const codingRows = () => codedEssays.map(({ x, e }) => {
    const c = coding[e.id];
    return {
      "Participant ID": x.p.participant_code, "Essay topic": safeTopic(e), "Word count": wordCount(e.content),
      ...Object.fromEntries(CODING_FIELDS.map(([k, l]) => [l, c?.[k] ?? ""])),
      "Researcher notes": c?.notes ?? "", "Coded at": c?.coded_at ?? "",
    };
  });

  const confirmRaw = (fn: () => void) => setPendingExport(() => fn);

  const exportAllPng = async () => {
    await downloadPng("figure1_messages_by_participant", fig1.current);
    await downloadPng("figure2_request_categories", fig2.current);
    await downloadPng("figure3_response_types", fig3.current);
  };

  const exportReport = async () => {
    const [i1, i2, i3] = await Promise.all([svgToPngDataUrl(fig1.current), svgToPngDataUrl(fig2.current), svgToPngDataUrl(fig3.current)]);
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const tbl = (rows: Record<string, unknown>[]) => rows.length
      ? `<table><tr>${Object.keys(rows[0]).map((k) => `<th>${esc(k)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${Object.values(r).map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</table>`
      : "<p>No data.</p>";
    const descriptor = CODING_FIELDS.map(([k, l]) => {
      const vals = codedEssays.map(({ e }) => coding[e.id]?.[k]).filter((v): v is number => typeof v === "number");
      return { Descriptor: l, "Essays coded": vals.length, "0": vals.filter((v) => v === 0).length, "1": vals.filter((v) => v === 1).length, "2": vals.filter((v) => v === 2).length };
    });
    const w = window.open("", "_blank");
    if (!w) return toast.error("Allow pop-ups to open the report");
    w.document.write(`<!doctype html><html><head><title>Research Analytics report</title><style>
      body{font-family:Georgia,serif;max-width:900px;margin:32px auto;color:#1f2937;line-height:1.5}
      h1{font-size:22px}h2{font-size:17px;margin-top:28px}table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left}img{max-width:100%;border:1px solid #e2e8f0}
      .note{font-style:italic;color:#475569}</style></head><body>
      <h1>Research Analytics report</h1><p class="note">Generated ${esc(new Date().toLocaleString())}. Participants are identified by anonymous IDs only.</p>
      <h2>Study overview</h2><p>${stats.started} participants started and ${stats.completed} completed the writing activity; ${stats.essaysAnalyzed} completed essays were analyzed.</p>
      <h2>Table 1. Overview of participants, completed essays, and AI interaction data.</h2>${tbl(table1Rows())}
      <h2>Figure 1. Number of student-initiated AI messages by participant.</h2>${i1 ? `<img src="${i1}"/>` : ""}
      <h2>Figure 2. Categories of writing support requested from the Socratic AI coach.</h2>${i2 ? `<img src="${i2}"/>` : ""}
      <p class="note">Based on verified categories.${catsReady ? "" : " Percentages withheld until all messages are reviewed."}</p>${tbl(catCounts.map((c) => ({ Category: c.label, Count: c.count, ...(catsReady ? { Percent: `${c.pct}%` } : {}) })))}
      <h2>Figure 3. Types of responses generated by the Socratic AI coach.</h2>${i3 ? `<img src="${i3}"/>` : ""}
      <p class="note">Based on verified response types.${typesReady ? "" : " Percentages withheld until all responses are reviewed; this chart is not evidence that the coach was fully Socratic."}</p>${tbl(typeCounts.map((c) => ({ "Response type": c.label, Count: c.count, ...(typesReady ? { Percent: `${c.pct}%` } : {}) })))}
      <h2>Direct-writing requests</h2><p>Direct-writing requests redirected with Socratic prompts: ${redirText}.</p>
      <h2>Completed essay characteristics</h2><p class="note">These descriptors summarize characteristics of completed essays. Because participants did not produce separate draft versions, these scores do not measure writing improvement over time.</p>${tbl(descriptor)}
      <h2>Methods note</h2><p>${esc(METHODS_NOTE)}</p>
      <script>setTimeout(()=>window.print(),400)</script></body></html>`);
    w.document.close();
  };

  if (loading) return <div className="text-muted-foreground">Loading research data…</div>;

  const pageSize = 25;
  const msgList = selInteractions.filter((i) => passStatus(statusOf(i.id)) && (!otherQueue || shownCat(i.id) === "other" || !shownCat(i.id)));
  const msgSlice = msgList.slice(msgPage * pageSize, (msgPage + 1) * pageSize);
  const respList = selInteractions.filter((i) => i.ai_response && passStatus(statusOf(i.id)) && (!otherRespQueue || shownType(i.id) === "other" || !shownType(i.id)));
  const respSlice = respList.slice(respPage * pageSize, (respPage + 1) * pageSize);
  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };
  const palette = ["hsl(var(--primary))", "hsl(var(--primary) / 0.8)", "hsl(var(--primary) / 0.65)", "hsl(var(--primary) / 0.5)", "hsl(var(--primary) / 0.38)", "hsl(var(--muted-foreground))", "hsl(var(--muted-foreground) / 0.7)", "hsl(var(--accent-foreground) / 0.6)", "hsl(var(--muted-foreground) / 0.45)", "hsl(var(--border))"];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold font-display text-foreground">Research Analytics</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">Descriptive patterns of AI coach use and characteristics of completed essays. Participants appear by anonymous ID only. These analytics do not measure writing improvement.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowManage((s) => !s)}><Users className="w-4 h-4 mr-1" />Participants & cohorts</Button>
          <Button variant="outline" size="sm" onClick={runClassify} disabled={classifying}>
            <Sparkles className="w-4 h-4 mr-1" />{classifying ? "Labelling…" : `Auto-label${unclassified ? ` (${unclassified} new)` : ""}`}
          </Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {showManage && (
        <Section title="Participants & cohorts" actions={<Button size="sm" onClick={assignIds}>Assign IDs to new students</Button>}>
          <div className="flex gap-2">
            <Input placeholder="New cohort name" value={newCohort} onChange={(e) => setNewCohort(e.target.value)} className="max-w-xs h-8" />
            <Button size="sm" variant="outline" onClick={addCohort}>Add cohort</Button>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs">
              <thead><tr><Th>Participant ID</Th><Th>Cohort</Th><Th>Consent</Th><Th>Included in study</Th></tr></thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.user_id} className="border-t border-border">
                    <Td>{p.participant_code}</Td>
                    <Td>
                      <select className={sel} value={p.study_cohort_id ?? ""} onChange={(e) => updateParticipant(p.user_id, { study_cohort_id: e.target.value || null })}>
                        <option value="">—</option>
                        {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </Td>
                    <Td>
                      <select className={sel} value={p.consent_status} onChange={(e) => updateParticipant(p.user_id, { consent_status: e.target.value })}>
                        <option value="unknown">unknown</option><option value="consented">consented</option><option value="withdrawn">withdrawn</option>
                      </select>
                    </Td>
                    <Td><input type="checkbox" checked={p.included} onChange={(e) => updateParticipant(p.user_id, { included: e.target.checked })} /></Td>
                  </tr>
                ))}
                {!participants.length && <tr><td className="p-3 text-muted-foreground" colSpan={4}>No participants yet. Use “Assign IDs to new students”.</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <label className="text-xs text-muted-foreground space-y-1">Study cohort
            <select className={`${sel} w-full`} value={cohort} onChange={(e) => setCohort(e.target.value)}>
              <option value="all">All cohorts</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground space-y-1">From<Input type="date" className="h-8" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground space-y-1">To<Input type="date" className="h-8" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground space-y-1 lg:col-span-2">Essay topic or assignment
            <select className={`${sel} w-full`} value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="all">All topics</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground space-y-1">Participant ID<Input className="h-8" placeholder="P01" value={pSearch} onChange={(e) => setPSearch(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground space-y-1">Review status (tables)
            <select className={`${sel} w-full`} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setMsgPage(0); setRespPage(0); }}>
              <option value="all">All</option><option value="verified">Verified</option><option value="unreviewed">Unreviewed</option><option value="corrected">Corrected</option>
            </select>
          </label>
          <label className="text-xs flex items-center gap-2 lg:col-span-2"><input type="checkbox" checked={anonTopics} onChange={(e) => setAnonTopics(e.target.checked)} />Anonymized topics in exports (T1, T2…); otherwise truncated to 40 characters</label>
          <div className="lg:col-span-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => downloadCsv("participant_engagement_filtered", participantRows())}><Download className="w-4 h-4 mr-1" />Export filtered data</Button>
          </div>
        </CardContent>
      </Card>

      <Section title="Research readiness">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            ["Student messages unreviewed", msgsUnreviewed], ["AI responses unreviewed", respUnreviewed],
            ["Direct-writing flags unreviewed", stats.flaggedUnverified], ["Completed essays not fully coded", codingUncoded],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="text-2xl font-semibold font-display text-foreground">{v}</div>
            </div>
          ))}
        </div>
        <p className={`text-sm font-medium ${msgsUnreviewed + respUnreviewed + stats.flaggedUnverified + codingUncoded ? "text-destructive" : "text-primary"}`}>
          {msgsUnreviewed + respUnreviewed + stats.flaggedUnverified + codingUncoded ? "Not ready for final export" : "Ready for final export — all records used in charts and statistics are verified."}
        </p>
      </Section>

      {/* 1 */}
      <Section title="1. Study overview" actions={<Button size="sm" variant="outline" onClick={() => downloadCsv("table1_overview", table1Rows())}><Download className="w-4 h-4 mr-1" />Table 1 CSV</Button>}>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            ["Participants who started", stats.started], ["Participants who completed", `${stats.completed} / ${stats.started}`],
            ["Completed essays analyzed", stats.essaysAnalyzed], ["Used AI coach at least once", `${stats.used} / ${stats.started}`],
            ["Started participants who did not use the AI coach", `${stats.startedNotUsed} / ${stats.started}`],
            ["Completed participants who did not use the AI coach", `${stats.completedNotUsed} / ${stats.completed}`],
            ["Student AI messages", stats.messages], ["AI responses", stats.responses],
            ["Mean student AI messages per participant who started", stats.mean], ["Mean student AI messages among AI users", stats.meanUsers],
            ["Median student AI messages per participant who started", stats.median],
            ["Range of student AI messages per participant who started", `${stats.min} – ${stats.max}`],
            ...(directReady ? [["Direct-writing requests (verified)", stats.direct], ["Socratic redirections", `${stats.redirected} / ${stats.direct}`]] : []),
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="text-2xl font-semibold font-display text-foreground">{v}</div>
            </div>
          ))}
        </div>
        <div>
          <p className="text-sm font-medium mb-2 italic">Table 1. Overview of participants, completed essays, and AI interaction data.</p>
          <table className="w-full text-sm border border-border">
            <thead><tr className="bg-muted/50"><Th>Measure</Th><Th>Result</Th></tr></thead>
            <tbody>{table1.map(([m, r]) => <tr key={m} className="border-t border-border"><td className="px-2 py-1.5">{m}</td><td className="px-2 py-1.5">{r}</td></tr>)}</tbody>
          </table>
        </div>
        {(stats.essaysAnalyzed > stats.completed || stats.rawSubmitted > stats.completed) && (
          <p className="text-sm rounded-md border border-destructive/40 bg-destructive/5 p-3 text-foreground">
            Data-quality warning: {stats.rawSubmitted} submitted essays exist for {stats.completed} completed participants in this selection. Only one essay per participant (their latest submission) is analyzed. Check for duplicate or test essays, and narrow the cohort or date range if needed.
          </p>
        )}
        {!!unclassified && <p className="text-xs text-muted-foreground">{unclassified} message(s) have no category yet. Direct-writing figures count verified or auto-labelled messages only — run Auto-label, then review.</p>}
      </Section>

      {/* 2 */}
      <Section title="2. Participant engagement" actions={<>
        <Button size="sm" variant="outline" onClick={() => downloadCsv("figure1_data", fig1Data)}><Download className="w-4 h-4 mr-1" />CSV</Button>
        <Button size="sm" variant="outline" onClick={() => downloadPng("figure1_messages_by_participant", fig1.current)}><ImageIcon className="w-4 h-4 mr-1" />PNG</Button>
      </>}>
        <p className="text-sm italic">Figure 1. Number of student-initiated AI messages by participant.</p>
        <div ref={fig1} className="h-72">
          <ResponsiveContainer>
            <BarChart data={fig1Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="id" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={tooltipStyle} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof fig1Data)[number];
                return <div style={tooltipStyle} className="p-2 space-y-0.5">
                  <div className="font-medium">{d.id}</div><div>Student AI messages: {d.messages}</div><div>AI responses: {d.responses}</div>
                  <div>Essay status: {d.status}</div><div>Word count: {d.words}</div><div>Direct-writing requests: {d.direct}</div>
                </div>;
              }} />
              <Bar dataKey="messages" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => downloadCsv("participant_engagement", participantRows())}><Download className="w-4 h-4 mr-1" />Participant table CSV</Button></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr>{Object.keys(participantRows()[0] ?? { "Participant ID": 1 }).map((k) => <Th key={k}>{k}</Th>)}</tr></thead>
            <tbody>{participantRows().map((r) => (
              <tr key={r["Participant ID"]} className="border-t border-border">
                {Object.entries(r).map(([k, v]) => <Td key={k}>{k.includes(" at") ? fmt(v as string) : k === "Essay ID" ? String(v).slice(0, 8) : String(v)}</Td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>

      {/* 3 */}
      <Section title="3. Categories of writing support requested" actions={<>
        <Button size="sm" variant="outline" onClick={() => downloadCsv("figure2_data", catCounts.map((c) => ({ Category: c.label, Count: c.count, ...(catsReady ? { Percent: c.pct } : {}) })))}><Download className="w-4 h-4 mr-1" />CSV</Button>
        <Button size="sm" variant="outline" onClick={() => downloadPng("figure2_request_categories", fig2.current)}><ImageIcon className="w-4 h-4 mr-1" />PNG</Button>
      </>}>
        <p className="text-sm italic">Figure 2. Categories of writing support requested from the Socratic AI coach.</p>
        <p className="text-xs text-muted-foreground">Based on verified categories.{catsReady ? "" : ` ${msgsUnreviewed} message(s) still unreviewed — percentages are hidden until every message has a verified category.`}</p>
        <div ref={fig2} className="h-80">
          <ResponsiveContainer>
            <BarChart data={catCounts} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="label" width={260} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _n, p) => [catsReady ? `${v} (${p.payload.pct}%)` : `${v}`, "Messages"]} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={otherQueue} onChange={(e) => { setOtherQueue(e.target.checked); setMsgPage(0); }} />Review queue: only messages labelled “Other or uncategorized”</label>
          <Button size="sm" variant="outline" onClick={() => confirmRaw(() => downloadCsv("student_messages_categories", messageRows()))}><Download className="w-4 h-4 mr-1" />Messages CSV</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><Th>Message</Th><Th>Participant</Th><Th>Essay</Th><Th>Student message</Th><Th>Auto category</Th><Th>Verified category</Th><Th>Direct-writing</Th><Th>Status</Th><Th>Reviewed</Th></tr></thead>
            <tbody>{msgSlice.map((i) => {
              const r = reviews[i.id];
              return (
                <tr key={i.id} className="border-t border-border">
                  <Td>{i.id.slice(0, 8)}</Td><Td>{pcode(i.student_id)}</Td><Td>{i.essay_id.slice(0, 8)}</Td>
                  <Td wide><Clip text={i.student_message} /></Td>
                  <Td>{REQUEST_CATEGORIES[r?.auto_request_category ?? ""] ?? "—"}</Td>
                  <Td>
                    <select className={sel} value={r?.final_request_category ?? ""} onChange={(e) => saveReview(i.id, { final_request_category: e.target.value || null, ...(e.target.value === "direct_writing" ? { is_direct_writing_request: true } : {}) })}>
                      <option value="">—</option>
                      {Object.entries(REQUEST_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </Td>
                  <Td>
                    <select className={sel} value={r?.is_direct_writing_request == null ? "" : String(r.is_direct_writing_request)} onChange={(e) => saveReview(i.id, { is_direct_writing_request: e.target.value === "" ? null : e.target.value === "true" })}>
                      <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                    </select>
                  </Td>
                  <Td>{r?.review_status ?? "unreviewed"}</Td><Td>{reviewer(r?.reviewed_by ?? null)} {fmt(r?.reviewed_at)}</Td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <Pager page={msgPage} total={msgList.length} size={pageSize} onChange={setMsgPage} />
      </Section>

      {/* 4 */}
      <Section title="4. AI response behavior" actions={<>
        <Button size="sm" variant="outline" onClick={() => downloadCsv("figure3_data", typeCounts.map((c) => ({ "Response type": c.label, Count: c.count, ...(typesReady ? { Percent: c.pct } : {}) })))}><Download className="w-4 h-4 mr-1" />CSV</Button>
        <Button size="sm" variant="outline" onClick={() => downloadPng("figure3_response_types", fig3.current)}><ImageIcon className="w-4 h-4 mr-1" />PNG</Button>
      </>}>
        <p className="text-sm italic">Figure 3. Types of responses generated by the Socratic AI coach.</p>
        <p className="text-xs text-muted-foreground">Based on verified response types.{typesReady ? "" : ` ${respUnreviewed} response(s) still unreviewed — percentages are hidden, and this chart should not be read as evidence that the coach was fully Socratic.`}</p>
        <div className="grid md:grid-cols-2 gap-4 items-center">
          <div ref={fig3} className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={typeCounts} dataKey="count" nameKey="label" innerRadius={60} outerRadius={100} paddingAngle={1}>
                  {typeCounts.map((_, idx) => <Cell key={idx} fill={palette[idx % palette.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n, p) => [typesReady ? `${v} (${p.payload.pct}%)` : `${v}`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="text-sm space-y-1">
            {typeCounts.map((t, idx) => (
              <li key={t.key} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: palette[idx % palette.length] }} />
                <span className="flex-1">{t.label}</span><span className="text-muted-foreground">{t.count}{typesReady ? ` (${t.pct}%)` : ""}</span>
              </li>
            ))}
            {!typeCounts.length && <li className="text-muted-foreground">No verified responses yet.</li>}
          </ul>
        </div>
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={otherRespQueue} onChange={(e) => { setOtherRespQueue(e.target.checked); setRespPage(0); }} />Review queue: only responses labelled “Other”</label>
          <Button size="sm" variant="outline" onClick={() => confirmRaw(() => downloadCsv("ai_responses_types", responseRows()))}><Download className="w-4 h-4 mr-1" />Responses CSV</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><Th>Response</Th><Th>Linked msg</Th><Th>Participant</Th><Th>Student request</Th><Th>AI response</Th><Th>Auto type</Th><Th>Verified type</Th><Th>Socratic</Th><Th>Boundary</Th><Th>Status</Th><Th>Reviewed</Th></tr></thead>
            <tbody>{respSlice.map((i) => {
              const r = reviews[i.id];
              const ynSel = (key: "is_socratic_response" | "is_boundary_redirection") => (
                <select className={sel} value={r?.[key] == null ? "" : String(r[key])} onChange={(e) => saveReview(i.id, { [key]: e.target.value === "" ? null : e.target.value === "true" })}>
                  <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                </select>
              );
              return (
                <tr key={i.id} className="border-t border-border">
                  <Td>R-{i.id.slice(0, 6)}</Td><Td>{i.id.slice(0, 8)}</Td><Td>{pcode(i.student_id)}</Td>
                  <Td wide><Clip text={i.student_message} /></Td><Td wide><Clip text={i.ai_response} /></Td>
                  <Td>{RESPONSE_TYPES[r?.auto_response_type ?? ""] ?? "—"}</Td>
                  <Td>
                    <select className={sel} value={r?.final_response_type ?? ""} onChange={(e) => saveReview(i.id, { final_response_type: e.target.value || null, ...(e.target.value === "boundary_redirection" ? { is_boundary_redirection: true } : {}) })}>
                      <option value="">—</option>
                      {Object.entries(RESPONSE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </Td>
                  <Td>{ynSel("is_socratic_response")}</Td><Td>{ynSel("is_boundary_redirection")}</Td>
                  <Td>{r?.review_status ?? "unreviewed"}</Td><Td>{reviewer(r?.reviewed_by ?? null)} {fmt(r?.reviewed_at)}</Td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <Pager page={respPage} total={respList.length} size={pageSize} onChange={setRespPage} />
      </Section>

      {/* 5 */}
      <Section title="5. Direct-writing request and boundary audit" actions={
        <Button size="sm" variant="outline" onClick={() => confirmRaw(() => downloadCsv("boundary_audit", auditRows()))}><Download className="w-4 h-4 mr-1" />Audit CSV</Button>
      }>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-lg font-display text-foreground">Direct-writing requests redirected with Socratic prompts: <strong>{redirText}</strong>.</p>
          {!directReady && <p className="text-xs text-muted-foreground mt-1">This total is calculated only after every flagged row below has been verified.</p>}
          <p className="text-xs text-muted-foreground mt-1">Direct-writing = a request for a ready-to-submit essay, paragraph, introduction, conclusion, multiple sentences, or a complete rewrite. Translation, vocabulary, grammar, spelling, single words, or “how do I say this in English” are not direct-writing requests.</p>
          <p className="text-xs text-muted-foreground mt-1">Neutral labels describe the request type and the coach's boundary response; they are not judgements about students.</p>
        </div>
        <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={auditOnlyDirect} onChange={(e) => setAuditOnlyDirect(e.target.checked)} />Show direct-writing requests only</label>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs">
            <thead><tr><Th>Participant</Th><Th>Essay</Th><Th>Date and time</Th><Th>Student request</Th><Th>AI response</Th><Th>Direct-writing</Th><Th>AI gave wording / translation</Th><Th>AI wrote ready text</Th><Th>Socratic redirection</Th><Th>Status</Th><Th>Reviewer notes</Th></tr></thead>
            <tbody>{auditList.map((i) => {
              const r = reviews[i.id];
              const ynSel = (key: "is_direct_writing_request" | "ai_provided_wording" | "ai_wrote_ready_text" | "is_boundary_redirection") => (
                <select className={sel} value={r?.[key] == null ? "" : String(r[key])} onChange={(e) => saveReview(i.id, { [key]: e.target.value === "" ? null : e.target.value === "true" })}>
                  <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                </select>
              );
              return (
                <tr key={i.id} className="border-t border-border">
                  <Td>{pcode(i.student_id)}</Td><Td>{i.essay_id.slice(0, 8)}</Td><Td>{fmt(i.created_at)}</Td>
                  <Td wide><Clip text={i.student_message} /></Td><Td wide><Clip text={i.ai_response} /></Td>
                  <Td>{ynSel("is_direct_writing_request")}</Td><Td>{ynSel("ai_provided_wording")}</Td><Td>{ynSel("ai_wrote_ready_text")}</Td><Td>{ynSel("is_boundary_redirection")}</Td>
                  <Td>{r?.review_status ?? "unreviewed"}</Td>
                  <Td><Input className="h-8 text-xs min-w-[160px]" defaultValue={r?.reviewer_notes ?? ""} onBlur={(e) => e.target.value !== (r?.reviewer_notes ?? "") && saveReview(i.id, { reviewer_notes: e.target.value })} /></Td>
                </tr>
              );
            })}
            {!auditList.length && <tr><td colSpan={11} className="p-3 text-muted-foreground">No direct-writing requests in the current selection.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6 */}
      <Section title="6. Completed Essay Characteristics" actions={<Button size="sm" variant="outline" onClick={() => downloadCsv("completed_essay_coding", codingRows())}><Download className="w-4 h-4 mr-1" />Coding CSV</Button>}>
        <p className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3">These descriptors summarize characteristics of completed essays. Because participants did not produce separate draft versions, these scores do not measure writing improvement over time.</p>
        <p className="text-xs text-muted-foreground">0 = absent, unclear, or not demonstrated · 1 = present but limited · 2 = clear and developed. Coded manually by the researcher.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><Th>Participant</Th><Th>Essay</Th><Th>Topic</Th><Th>Words</Th>{CODING_FIELDS.map(([, l]) => <Th key={l}>{l}</Th>)}<Th>Researcher notes</Th><Th>Coded</Th></tr></thead>
            <tbody>{codedEssays.map(({ x, e }) => {
              const c = coding[e.id];
              return (
                <tr key={e.id} className="border-t border-border">
                  <Td>{x.p.participant_code}</Td><Td>{e.id.slice(0, 8)}</Td><Td wide>{essayTopic(e)}</Td><Td>{wordCount(e.content)}</Td>
                  {CODING_FIELDS.map(([k]) => (
                    <Td key={k}>
                      <select className={sel} value={c?.[k] == null ? "" : String(c[k])} onChange={(ev) => saveCoding(e.id, { [k]: ev.target.value === "" ? null : Number(ev.target.value) })}>
                        <option value="">—</option><option value="0">0</option><option value="1">1</option><option value="2">2</option>
                      </select>
                    </Td>
                  ))}
                  <Td><Input className="h-8 text-xs min-w-[160px]" defaultValue={c?.notes ?? ""} onBlur={(ev) => ev.target.value !== (c?.notes ?? "") && saveCoding(e.id, { notes: ev.target.value })} /></Td>
                  <Td>{reviewer(c?.coded_by ?? null)} {fmt(c?.coded_at)}</Td>
                </tr>
              );
            })}
            {!codedEssays.length && <tr><td colSpan={12} className="p-3 text-muted-foreground">No completed essays in the current selection.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 7 */}
      <Section title="7. Research exports">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadCsv("table1_overview", table1Rows())}>Table 1 CSV</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv("participant_engagement", participantRows())}>Participant engagement CSV</Button>
          <Button size="sm" variant="outline" onClick={() => confirmRaw(() => downloadCsv("student_messages_categories", messageRows()))}>Student messages CSV</Button>
          <Button size="sm" variant="outline" onClick={() => confirmRaw(() => downloadCsv("ai_responses_types", responseRows()))}>AI responses CSV</Button>
          <Button size="sm" variant="outline" onClick={() => confirmRaw(() => downloadCsv("boundary_audit", auditRows()))}>Boundary audit CSV</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv("completed_essay_coding", codingRows())}>Essay coding CSV</Button>
          <Button size="sm" variant="outline" onClick={exportAllPng}><ImageIcon className="w-4 h-4 mr-1" />All charts PNG</Button>
          <Button size="sm" onClick={exportReport}><FileText className="w-4 h-4 mr-1" />Combined report (print / PDF)</Button>
        </div>
        <p className="text-xs text-muted-foreground">Methods note: {METHODS_NOTE}</p>
      </Section>

      <AlertDialog open={!!pendingExport} onOpenChange={(o) => !o && setPendingExport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export raw message text?</AlertDialogTitle>
            <AlertDialogDescription>This file contains the original student messages and AI responses. Participants are identified by anonymous ID only, but message text may still contain personal details. Store it securely and use it only for the approved research.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { pendingExport?.(); setPendingExport(null); }}>Export</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
