import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Sparkles, Shield, Clock, Play, ClipboardPaste,
  GraduationCap, BookOpen, Gauge, Languages, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings, type Lang } from "@/contexts/SettingsContext";

const PILLARS = [
  {
    key: "brainstorm",
    icon: Sparkles,
    label: "Brainstorm & Topic Generator",
    tint: "bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-500",
    body:
      "An untimed creative space. Type a rough idea and the AI returns polished academic topics with a full research brief — background context, key arguments, and vocabulary — plus idea starter pills when inspiration runs dry.",
    points: ["Untimed drafting with draft & pause", "Dynamic research briefs", "Idea starter pills"],
  },
  {
    key: "classroom",
    icon: Shield,
    label: "Classroom Socratic Mode",
    tint: "bg-primary/10 border-primary/30",
    dot: "bg-primary",
    body:
      "Guided writing under teacher oversight. Students join with a lesson passcode, write in a locked focus environment, and get Socratic coaching that asks questions instead of writing sentences.",
    points: ["6-digit lesson codes & exit passcode", "Live teacher feed", "AI coaching guardrails"],
  },
  {
    key: "solo",
    icon: Clock,
    label: "Solo Exam Practice",
    tint: "bg-muted border-border",
    dot: "bg-muted-foreground",
    body:
      "Timed SAT/IELTS-style simulations with strict exam rules: no AI assistant, no draft saving, custom countdown. On submission students get an instant AI breakdown of strengths, weaknesses, and next steps.",
    points: ["Custom timer (20/45/60 min)", "No AI during the exam", "Instant post-submission feedback"],
  },
] as const;

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "kk", label: "Қазақша" },
];

const Landing = () => {
  const navigate = useNavigate();
  const { lang, setLang } = useSettings();
  const [active, setActive] = useState<string>("classroom");
  const pillar = PILLARS.find((p) => p.key === active)!;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2 font-display font-bold text-foreground">
            <GraduationCap className="w-5 h-5 text-primary" />FocusWrite AI
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="#modes" className="hidden sm:inline text-sm font-display text-muted-foreground hover:text-foreground px-2">Modes</a>
            <a href="#integrity" className="hidden sm:inline text-sm font-display text-muted-foreground hover:text-foreground px-2">For Teachers</a>
            <Button size="sm" variant="outline" className="font-display" onClick={() => navigate("/auth")}>Teacher Login</Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-display text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-success" />Built for Kazakhstani high schools
          </span>
          <h1 className="mt-5 font-display font-bold text-4xl md:text-5xl leading-tight text-foreground">
            Empowering Academic Integrity with Socratic AI Writing Guidance
          </h1>
          <p className="mt-5 text-lg font-display text-muted-foreground leading-relaxed">
            The smart writing platform built for Kazakhstani high schools — helping students write
            independently while giving teachers total transparency.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="font-display" onClick={() => navigate("/auth")}>
              Try Demo Class <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" className="font-display" onClick={() => navigate("/auth")}>
              Teacher Login
            </Button>
          </div>
        </div>

        {/* Editor mockup */}
        <div className="rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="h-10 border-b border-border flex items-center gap-3 px-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-display font-medium text-success">
              <Shield className="w-3.5 h-3.5" />Focus Mode
            </span>
            <span className="text-[11px] text-muted-foreground font-display truncate">
              Should social media be regulated in schools?
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-display text-muted-foreground">
              <Clock className="w-3 h-3" />32:14
            </span>
          </div>
          <div className="grid grid-cols-5 min-h-[300px]">
            <div className="col-span-3 p-4 space-y-2 border-r border-border">
              <p className="font-display text-sm text-foreground leading-relaxed">
                Social media shapes how students think long before they enter a classroom…
              </p>
              <div className="h-2 rounded bg-muted w-11/12" />
              <div className="h-2 rounded bg-muted w-10/12" />
              <div className="h-2 rounded bg-muted w-8/12" />
              <div className="h-2 rounded bg-muted w-11/12" />
              <div className="h-2 rounded bg-muted w-6/12" />
            </div>
            <div className="col-span-2 p-3 space-y-2 bg-muted/30">
              <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground">Socratic AI Tutor</p>
              <div className="rounded-lg bg-card border border-border p-2 text-[11px] font-display text-foreground">
                What evidence makes your first claim convincing?
              </div>
              <div className="rounded-lg bg-primary text-primary-foreground p-2 text-[11px] font-display ml-6">
                Maybe screen-time data?
              </div>
              <div className="rounded-lg bg-card border border-border p-2 text-[11px] font-display text-foreground">
                Good — whose data, and what would it prove?
              </div>
              <p className="text-[10px] font-display text-muted-foreground pt-1">
                The tutor never writes your essay.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mode selector */}
      <section id="modes" className="border-y border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="font-display font-bold text-3xl text-foreground">Three core pillars</h2>
          <p className="mt-2 font-display text-muted-foreground">Pick a mode to see how it works.</p>

          <div className="mt-8 grid md:grid-cols-3 gap-3">
            {PILLARS.map((p) => (
              <button
                key={p.key}
                onClick={() => setActive(p.key)}
                aria-pressed={active === p.key}
                className={`text-left rounded-xl border p-4 transition-all ${p.tint} ${
                  active === p.key ? "ring-2 ring-primary/50 shadow-md" : "hover:shadow-sm"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${p.dot}`} />
                  <p.icon className="w-4 h-4 text-foreground" />
                </span>
                <p className="mt-2 font-display font-semibold text-foreground">{p.label}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <p className="font-display text-foreground leading-relaxed">{pillar.body}</p>
            <ul className="mt-4 grid sm:grid-cols-3 gap-2">
              {pillar.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2 text-sm font-display text-muted-foreground">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${pillar.dot}`} />{pt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Teacher integrity toolkit */}
      <section id="integrity" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="font-display font-bold text-3xl text-foreground">Teacher Integrity Toolkit</h2>
        <p className="mt-2 font-display text-muted-foreground max-w-2xl">
          Every essay comes with the evidence of how it was written — not just the final text.
        </p>

        <div className="mt-8 grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" />Writing Playback & Heatmap
            </h3>
            <p className="mt-2 text-sm font-display text-muted-foreground">
              Fast-forward the entire writing session at 1x–10x and watch the essay appear keystroke by keystroke.
            </p>
            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
              <div className="relative h-4">
                <div className="absolute inset-x-0 top-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary animate-[pulse_2s_ease-in-out_infinite] w-2/3" />
                </div>
                <span className="absolute top-0 h-4 w-1.5 rounded-sm bg-destructive" style={{ left: "42%" }} />
                <span className="absolute top-0 h-4 w-1.5 rounded-sm bg-destructive" style={{ left: "71%" }} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                {["1x", "2x", "5x", "10x"].map((s, i) => (
                  <span key={s} className={`rounded px-2 py-0.5 text-[11px] font-display ${i === 1 ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>{s}</span>
                ))}
                <span className="ml-auto text-[11px] font-display text-destructive">2 paste events flagged</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-destructive" />Paste Tracker & AI Reliance Meter
            </h3>
            <p className="mt-2 text-sm font-display text-muted-foreground">
              Pasting is blocked in the editor and every attempt is logged in red on the timeline. An AI-probability
              check and the full tutor chat log show exactly how much help was used.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-display text-muted-foreground mb-1">
                  <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" />AI reliance</span><span>18%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full w-[18%] bg-success" /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-display text-muted-foreground mb-1">
                  <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />Independent writing</span><span>82%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full w-[82%] bg-primary" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 font-display font-bold text-foreground">
              <GraduationCap className="w-5 h-5 text-primary" />FocusWrite AI
            </div>
            <p className="mt-3 text-sm font-display text-muted-foreground">
              Socratic AI writing guidance and academic-integrity tooling for schools.
            </p>
          </div>

          <div>
            <p className="font-display font-semibold text-foreground text-sm">Resources</p>
            <ul className="mt-3 space-y-2 text-sm font-display text-muted-foreground">
              <li><a href="#modes" className="hover:text-foreground">Writing modes</a></li>
              <li><a href="#integrity" className="hover:text-foreground">Teacher toolkit</a></li>
              <li><Link to="/auth" className="hover:text-foreground">Sign in</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-display font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Languages className="w-4 h-4" />Language
            </p>
            <div className="mt-3 flex gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  aria-pressed={lang === l.code}
                  className={`rounded-md border px-2.5 py-1 text-xs font-display transition-colors ${
                    lang === l.code ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs font-display text-muted-foreground">
              The platform interface is fully available in English, Russian and Kazakh.
            </p>
            <Button size="sm" className="font-display mt-4" onClick={() => navigate("/auth")}>
              <Mail className="w-3.5 h-3.5 mr-1" />School onboarding inquiry
            </Button>
          </div>
        </div>
        <div className="border-t border-border py-4 text-center text-xs font-display text-muted-foreground">
          © {new Date().getFullYear()} FocusWrite AI
        </div>
      </footer>
    </div>
  );
};

export default Landing;
