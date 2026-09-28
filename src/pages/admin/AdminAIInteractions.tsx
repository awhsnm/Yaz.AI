import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { logRequestError } from "@/lib/logError";

// ---------- types ----------

interface Overview {
  total_interactions: number;
  students_interacted: number;
  avg_per_student: number;
  avg_per_essay: number;
  essays_with_activity: number;
  daily: { day: string; count: number }[];
  weekly: { week: string; count: number }[];
  categories: { category: string; count: number }[];
  sources: { source: string; count: number }[];
}

interface EssayRow {
  student_id: string;
  student_email: string;
  student_name: string | null;
  essay_id: string;
  essay_number: number;
  essay_topic: string;
  essay_mode: string;
  created_at: string;
  word_count: number;
  writing_duration: number;
  active_focus_time: number;
  average_focus_session: number;
  longest_focus_session: number;
  number_of_focus_sessions: number;
  number_of_focus_interruptions: number;
  external_window_switches: number;
  total_ai_interactions: number;
  ai_interactions_per_100_words: number;
  socratic_interactions: number;
  writing_generation_requests: number;
  predefined_prompt_usage: number;
  revision_feedback_requests: number;
  off_task_interactions: number;
  average_time_to_resume_writing_after_ai: number | null;
  average_time_to_resume_writing_after_focus_loss: number | null;
  time_in_ai_interface: number;
  essay_completion_time: number | null;
  is_submitted: boolean;
}

interface InteractionRow {
  interaction_id: string;
  student_id: string;
  student_email: string;
  essay_id: string;
  interaction_at: string;
  interaction_type: string;
  source: string;
  student_message: string;
  ai_response: string | null;
  primary_category: string | null;
  confidence_score: number | null;
  classification_reason: string | null;
  word_count_at_interaction: number | null;
  continued_writing: boolean;
  seconds_to_next_writing: number | null;
}

interface MetricsJson extends Record<string, unknown> {
  word_count?: number;
  writing_duration_seconds?: number;
  active_focus_time_seconds?: number;
  inactive_time_seconds?: number;
  number_of_focus_sessions?: number;
  average_focus_session_seconds?: number;
  median_focus_session_seconds?: number;
  longest_focus_session_seconds?: number;
  number_of_focus_interruptions?: number;
  average_inactive_period_seconds?: number;
  average_active_stretch_between_interruptions_seconds?: number;
  external_window_switches?: number;
  total_ai_interactions?: number;
  ai_interactions_per_100_words?: number;
  socratic_interactions?: number;
  writing_generation_requests?: number;
  predefined_prompt_usage?: number;
  revision_feedback_requests?: number;
  off_task_interactions?: number;
  average_time_to_resume_writing_after_ai_seconds?: number | null;
  average_time_to_resume_writing_after_focus_loss_seconds?: number | null;
  time_in_ai_interface_seconds?: number;
  essay_completion_time_seconds?: number | null;
  inactivity_threshold_seconds?: number;
}

interface TimelineRow {
  event_at: string;
  event_kind: string;
  detail: string;
}

// New RPCs are admin-only and not part of the generated typed surface.
const callRpc = async <T,>(
  fn: string,
  args?: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string } | null }> => {
  const client = supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
  };
  return client.rpc(fn, args);
};

// ---------- helpers ----------

const CATEGORIES = [
  { value: "socratic_use", label: "Socratic use" },
  { value: "generation_request", label: "Asked AI to write" },
  { value: "predefined_prompt", label: "Predefined prompts" },
  { value: "revision_feedback", label: "Revision / feedback" },
  { value: "off_task", label: "Off-task" },
  { value: "other", label: "Other / unclear" },
  { value: "unclassified", label: "Unclassified" },
];

const catLabel = (c: string | null) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? (c ?? "—");

const PIE_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#64748B", "#CBD5E1"];

const fmtDuration = (s?: number | null) => {
  if (s === null || s === undefined) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
};

const shortName = (r: EssayRow) =>
  r.student_name || r.student_email.split("@")[0];

const essayLabel = (r: EssayRow) => `#${r.essay_number} ${shortName(r)}`;

const toCsv = (headers: string[], rows: (string | number | boolean | null)[][]) =>
  [headers, ...rows]
    .map((r) =>
      r
        .map((v) => {
          const s = v === null || v === undefined ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");

const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const ChartCard = ({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={`rounded-xl border border-border bg-card p-4 ${wide ? "lg:col-span-2" : ""}`}>
    <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
    {children}
  </div>
);

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-semibold font-display text-foreground">{value}</p>
  </div>
);

// ---------- page ----------

const AdminAIInteractions = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rows, setRows] = useState<EssayRow[]>([]);
  const [interactions, setInteractions] = useState<InteractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [studentFilter, setStudentFilter] = useState("all");
  const [essayFilter, setEssayFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [essayNumberFilter, setEssayNumberFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [detailEssay, setDetailEssay] = useState<EssayRow | null>(null);
  const [metrics, setMetrics] = useState<MetricsJson | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, r, i] = await Promise.all([
      callRpc<Overview>("ai_interaction_overview"),
      callRpc<EssayRow[]>("research_export_rows"),
      callRpc<InteractionRow[]>("research_export_interactions"),
    ]);
    if (o.error || r.error || i.error) {
      logRequestError("admin-ai-interactions", o.error ?? r.error ?? i.error);
      setFailed(true);
    } else {
      setFailed(false);
      setOverview(o.data);
      setRows((r.data ?? []) as EssayRow[]);
      setInteractions((i.data ?? []) as InteractionRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openDetail = useCallback(async (row: EssayRow) => {
    setDetailEssay(row);
    setMetrics(null);
    setTimeline([]);
    setDetailLoading(true);
    const [m, t] = await Promise.all([
      callRpc<MetricsJson>("essay_focus_metrics", { _essay_id: row.essay_id }),
      callRpc<TimelineRow[]>("essay_interaction_timeline", { _essay_id: row.essay_id }),
    ]);
    if (m.error) logRequestError("admin-ai-interactions-metrics", m.error);
    if (t.error) logRequestError("admin-ai-interactions-timeline", t.error);
    setMetrics(m.data);
    setTimeline((t.data ?? []) as TimelineRow[]);
    setDetailLoading(false);
  }, []);

  // ---- filters ----
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (studentFilter !== "all" && r.student_id !== studentFilter) return false;
      if (essayFilter !== "all" && r.essay_id !== essayFilter) return false;
      if (fromDate && new Date(r.created_at) < new Date(fromDate)) return false;
      if (toDate && new Date(r.created_at) > new Date(`${toDate}T23:59:59`)) return false;
      if (essayNumberFilter && String(r.essay_number) !== essayNumberFilter) return false;
      return true;
    });
  }, [rows, studentFilter, essayFilter, fromDate, toDate, essayNumberFilter]);

  const filteredInteractions = useMemo(() => {
    return interactions.filter((i) => {
      if (studentFilter !== "all" && i.student_id !== studentFilter) return false;
      if (essayFilter !== "all" && i.essay_id !== essayFilter) return false;
      if (fromDate && new Date(i.interaction_at) < new Date(fromDate)) return false;
      if (toDate && new Date(i.interaction_at) > new Date(`${toDate}T23:59:59`)) return false;
      if (categoryFilter !== "all" && (i.primary_category ?? "unclassified") !== categoryFilter) return false;
      return true;
    });
  }, [interactions, studentFilter, essayFilter, fromDate, toDate, categoryFilter]);

  const students = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.student_id, r.student_name || r.student_email));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const essayOptions = useMemo(
    () =>
      rows
        .filter((r) => studentFilter === "all" || r.student_id === studentFilter)
        .sort((a, b) => a.essay_number - b.essay_number),
    [rows, studentFilter],
  );

  const dailyFiltered = useMemo(() => {
    if (!overview?.daily) return [];
    return overview.daily.filter((d) => {
      if (fromDate && new Date(d.day) < new Date(fromDate)) return false;
      if (toDate && new Date(d.day) > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [overview, fromDate, toDate]);

  // ---- derived chart data ----
  const continuationByCategory = useMemo(() => {
    const map = new Map<string, { cont: number; total: number }>();
    filteredInteractions.forEach((i) => {
      const key = i.primary_category ?? "unclassified";
      const cur = map.get(key) ?? { cont: 0, total: 0 };
      cur.total += 1;
      if (i.continued_writing) cur.cont += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      category: catLabel(k),
      pct: v.total ? Math.round((v.cont / v.total) * 100) : 0,
      total: v.total,
    }));
  }, [filteredInteractions]);

  const focusByCategory = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    filteredInteractions.forEach((i) => {
      const key = i.primary_category ?? "unclassified";
      const row = rows.find((r) => r.essay_id === i.essay_id);
      if (!row) return;
      const cur = map.get(key) ?? { sum: 0, n: 0 };
      cur.sum += row.active_focus_time;
      cur.n += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      category: catLabel(k),
      minutes: Math.round(v.sum / v.n / 60),
    }));
  }, [filteredInteractions, rows]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading analytics…</p>;
  }
  if (failed) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card text-sm text-muted-foreground space-y-3">
        <p>We couldn't load the AI interaction analytics just now.</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
      </div>
    );
  }

  const exportRows = () => {
    downloadCsv(
      "research-student-essay-dataset.csv",
      toCsv(
        [
          "student_id", "student_email", "student_name", "essay_id", "essay_number", "essay_topic", "essay_mode",
          "created_at", "word_count", "writing_duration_s", "active_focus_time_s", "average_focus_session_s",
          "longest_focus_session_s", "number_of_focus_sessions", "number_of_focus_interruptions",
          "external_window_switches", "total_ai_interactions", "ai_interactions_per_100_words",
          "socratic_interactions", "writing_generation_requests", "predefined_prompt_usage",
          "revision_feedback_requests", "off_task_interactions", "avg_time_to_resume_after_ai_s",
          "avg_time_to_resume_after_focus_loss_s", "time_in_ai_interface_s", "essay_completion_time_s", "is_submitted",
        ],
        filteredRows.map((r) => [
          r.student_id, r.student_email, r.student_name, r.essay_id, r.essay_number, r.essay_topic, r.essay_mode,
          r.created_at, r.word_count, r.writing_duration, r.active_focus_time, r.average_focus_session,
          r.longest_focus_session, r.number_of_focus_sessions, r.number_of_focus_interruptions,
          r.external_window_switches, r.total_ai_interactions, r.ai_interactions_per_100_words,
          r.socratic_interactions, r.writing_generation_requests, r.predefined_prompt_usage,
          r.revision_feedback_requests, r.off_task_interactions, r.average_time_to_resume_writing_after_ai,
          r.average_time_to_resume_writing_after_focus_loss, r.time_in_ai_interface, r.essay_completion_time, r.is_submitted,
        ]),
      ),
    );
  };

  const exportInteractions = () => {
    downloadCsv(
      "research-interaction-level-dataset.csv",
      toCsv(
        [
          "interaction_id", "student_id", "student_email", "essay_id", "interaction_at", "interaction_type", "source",
          "student_message", "ai_response", "primary_category", "confidence_score", "classification_reason",
          "word_count_at_interaction", "continued_writing", "seconds_to_next_writing",
        ],
        filteredInteractions.map((i) => [
          i.interaction_id, i.student_id, i.student_email, i.essay_id, i.interaction_at, i.interaction_type, i.source,
          i.student_message, i.ai_response, i.primary_category, i.confidence_score, i.classification_reason,
          i.word_count_at_interaction, i.continued_writing, i.seconds_to_next_writing,
        ]),
      ),
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Total AI interactions" value={overview?.total_interactions ?? 0} />
        <Metric label="Students who interacted" value={overview?.students_interacted ?? 0} />
        <Metric label="Avg per student" value={overview?.avg_per_student ?? 0} />
        <Metric label="Avg per essay" value={overview?.avg_per_essay ?? 0} />
        <Metric label="Essays with activity" value={overview?.essays_with_activity ?? 0} />
      </section>

      {/* Filters */}
      <section className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <select
          value={studentFilter}
          onChange={(e) => { setStudentFilter(e.target.value); setEssayFilter("all"); setDetailEssay(null); }}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          aria-label="Filter by student"
        >
          <option value="all">All students</option>
          {students.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select
          value={essayFilter}
          onChange={(e) => { setEssayFilter(e.target.value); setDetailEssay(null); }}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          aria-label="Filter by essay"
        >
          <option value="all">All essays</option>
          {essayOptions.map((r) => (
            <option key={r.essay_id} value={r.essay_id}>
              #{r.essay_number} — {r.essay_topic.slice(0, 40)}
            </option>
          ))}
        </select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
        <Input
          type="number"
          min={1}
          placeholder="Essay no."
          value={essayNumberFilter}
          onChange={(e) => setEssayNumberFilter(e.target.value)}
          aria-label="Essay number"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          aria-label="Filter by interaction category"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </section>

      {/* Exports */}
      <section className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="outline" onClick={exportRows}>
          <Download className="w-4 h-4 mr-1" /> Export student × essay dataset ({filteredRows.length} rows)
        </Button>
        <Button size="sm" variant="outline" onClick={exportInteractions}>
          <Download className="w-4 h-4 mr-1" /> Export interaction dataset ({filteredInteractions.length} rows)
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
        <p className="text-xs text-muted-foreground">
          Raw events and derived metrics are stored separately; nothing here is a single engagement score.
        </p>
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="AI interactions over time" wide>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyFiltered}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={false} name="Interactions" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribution of interaction categories">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={(overview?.categories ?? []).map((c) => ({ name: catLabel(c.category), value: c.count }))}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
              >
                {(overview?.categories ?? []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Average active focus time per essay">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={filteredRows.map((r) => ({ name: essayLabel(r), minutes: Math.round(r.active_focus_time / 60) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="minutes" fill="#2563EB" name="Active focus (min)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Average focus session duration">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={filteredRows.map((r) => ({ name: essayLabel(r), minutes: Math.round(r.average_focus_session / 60) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="minutes" fill="#10B981" name="Avg session (min)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="External-window switches per essay">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={filteredRows.map((r) => ({ name: essayLabel(r), switches: r.external_window_switches }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="switches" fill="#F59E0B" name="Window switches" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="AI interactions per 100 words">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={filteredRows.map((r) => ({ name: essayLabel(r), per100: r.ai_interactions_per_100_words }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="per100" fill="#8B5CF6" name="Interactions / 100 words" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Category vs. writing continuation">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={continuationByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="category" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Bar dataKey="pct" fill="#2563EB" name="Kept writing after AI (%)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Category vs. average essay focus time">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={focusByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="category" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="minutes" fill="#10B981" name="Active focus (min)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Focus interruptions vs. completion time">
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="x"
                name="Interruptions"
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                label={{ value: "Focus interruptions", fontSize: 11, position: "insideBottom", offset: -2 }}
              />
              <YAxis
                dataKey="y"
                name="Completion (min)"
                tick={{ fontSize: 11 }}
                label={{ value: "Completion (min)", fontSize: 11, angle: -90, position: "insideLeft" }}
              />
              <Tooltip />
              <Scatter
                data={filteredRows
                  .filter((r) => r.essay_completion_time !== null)
                  .map((r) => ({ x: r.number_of_focus_interruptions, y: Math.round((r.essay_completion_time ?? 0) / 60), name: essayLabel(r) }))}
                fill="#F59E0B"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="AI interactions by essay number (student trends)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={[...filteredRows].sort((a, b) => a.essay_number - b.essay_number).map((r) => ({ name: essayLabel(r), interactions: r.total_ai_interactions }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="interactions" stroke="#8B5CF6" strokeWidth={2} name="AI interactions" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Per-essay explorer */}
      <section className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">Essay explorer</h2>
          <p className="text-xs text-muted-foreground">Select an essay to inspect its full interaction timeline.</p>
          <select
            value={detailEssay?.essay_id ?? ""}
            onChange={(e) => {
              const row = rows.find((r) => r.essay_id === e.target.value);
              if (row) void openDetail(row); else setDetailEssay(null);
            }}
            className="ml-auto rounded-md border border-border bg-background px-2 py-1.5 text-sm max-w-[320px]"
            aria-label="Choose essay to inspect"
          >
            <option value="">Choose an essay…</option>
            {[...rows]
              .sort((a, b) => a.student_email.localeCompare(b.student_email) || a.essay_number - b.essay_number)
              .map((r) => (
                <option key={r.essay_id} value={r.essay_id}>
                  {shortName(r)} — #{r.essay_number} {r.essay_topic.slice(0, 30)}
                </option>
              ))}
          </select>
        </div>

        {detailEssay && (
          <div className="p-4 space-y-4">
            {detailLoading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading essay detail…</p>
            ) : (
              <>
                <div className="text-sm">
                  <p className="font-medium text-foreground">{detailEssay.essay_topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {detailEssay.student_name || detailEssay.student_email} · {detailEssay.essay_mode} ·
                    {" "}{detailEssay.word_count} words · {detailEssay.is_submitted ? "submitted" : "draft"}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  <Metric label="Active focus time" value={fmtDuration(metrics?.active_focus_time_seconds)} />
                  <Metric label="Total session duration" value={fmtDuration(metrics?.writing_duration_seconds)} />
                  <Metric label="Inactive time" value={fmtDuration(metrics?.inactive_time_seconds)} />
                  <Metric label="AI interactions" value={metrics?.total_ai_interactions ?? 0} />
                  <Metric label="Socratic interactions" value={metrics?.socratic_interactions ?? 0} />
                  <Metric label="Writing-generation requests" value={metrics?.writing_generation_requests ?? 0} />
                  <Metric label="Predefined prompts" value={metrics?.predefined_prompt_usage ?? 0} />
                  <Metric label="External-window switches" value={metrics?.external_window_switches ?? 0} />
                  <Metric label="Focus sessions" value={metrics?.number_of_focus_sessions ?? 0} />
                  <Metric label="Average focus session" value={fmtDuration(metrics?.average_focus_session_seconds)} />
                  <Metric label="Median focus session" value={fmtDuration(metrics?.median_focus_session_seconds)} />
                  <Metric label="Longest uninterrupted period" value={fmtDuration(metrics?.longest_focus_session_seconds)} />
                  <Metric label="Focus interruptions" value={metrics?.number_of_focus_interruptions ?? 0} />
                  <Metric label="Average inactive period" value={fmtDuration(metrics?.average_inactive_period_seconds)} />
                  <Metric label="Resume after AI (avg)" value={fmtDuration(metrics?.average_time_to_resume_writing_after_ai_seconds)} />
                  <Metric label="Resume after focus loss (avg)" value={fmtDuration(metrics?.average_time_to_resume_writing_after_focus_loss_seconds)} />
                  <Metric label="Time in AI panel" value={fmtDuration(metrics?.time_in_ai_interface_seconds)} />
                  <Metric label="Completion time" value={fmtDuration(metrics?.essay_completion_time_seconds)} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Interactions ({filteredInteractions.filter((i) => i.essay_id === detailEssay.essay_id).length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {interactions
                        .filter((i) => i.essay_id === detailEssay.essay_id)
                        .map((i) => (
                          <div key={i.interaction_id} className="rounded-lg border border-border bg-background p-2.5 text-xs space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-muted-foreground">{new Date(i.interaction_at).toLocaleTimeString()}</span>
                              <span className="rounded-full px-2 py-0.5 bg-primary/10 text-primary font-medium">{catLabel(i.primary_category)}</span>
                              {i.source === "quick_prompt" && (
                                <span className="rounded-full px-2 py-0.5 bg-muted text-muted-foreground">predefined</span>
                              )}
                              <span className="text-muted-foreground">confidence: {i.confidence_score ?? "—"}</span>
                              <span className="text-muted-foreground">
                                {i.continued_writing ? `kept writing after ${fmtDuration(i.seconds_to_next_writing)}` : "no further writing recorded"}
                              </span>
                            </div>
                            <p className="text-foreground">Student: {i.student_message}</p>
                            {i.ai_response && <p className="text-muted-foreground">AI: {i.ai_response}</p>}
                            {i.classification_reason && (
                              <p className="text-muted-foreground italic">Why classified: {i.classification_reason}</p>
                            )}
                          </div>
                        ))}
                      {interactions.filter((i) => i.essay_id === detailEssay.essay_id).length === 0 && (
                        <p className="text-xs text-muted-foreground">No AI interactions recorded on this essay.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Timeline ({timeline.length})
                    </h4>
                    <div className="space-y-1 max-h-96 overflow-y-auto pr-1 text-xs">
                      {timeline.map((e, idx) => (
                        <div key={idx} className="flex gap-2 items-baseline">
                          <span className="font-mono text-muted-foreground shrink-0">
                            {new Date(e.event_at).toLocaleTimeString()}
                          </span>
                          <span className="text-foreground">{e.detail}</span>
                        </div>
                      ))}
                      {timeline.length === 0 && (
                        <p className="text-muted-foreground">No recorded activity for this essay.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminAIInteractions;
