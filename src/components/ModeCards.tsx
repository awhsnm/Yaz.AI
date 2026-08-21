import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, PenLine, Sparkles, Loader2, ArrowRight, Clock, ShieldAlert, MessageSquareOff, ChevronLeft, Mic, MicOff, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SUBJECTS = ["English", "Russian Literature", "Kazakh Literature", "General"];
const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-topics`;
const OCR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-image-text`;


const DURATIONS = [
  { value: "20", label: "20 min · Speedrun" },
  { value: "45", label: "45 min · Standard" },
  { value: "60", label: "60 min · Extended" },
  { value: "custom", label: "Custom…" },
];

const PILLS = [
  { emoji: "🧬", text: "Generate topics based on my upcoming Biology exam notes..." },
  { emoji: "🧠", text: "How modern internet culture and Brainrot affect Gen Z attention span..." },
  { emoji: "🎭", text: "How K-pop beauty standards influence global youth self-image..." },
];

type Angle = { label: string; detail: string };
type Vocab = { term: string; definition: string };
type GeneratedTopic = {
  title: string;
  focus: string;
  background?: string;
  facts?: string[];
  angles?: Angle[];
  vocabulary?: Vocab[];
  guiding_question?: string;
};

const ModeCards = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [soloOpen, setSoloOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [soloTopic, setSoloTopic] = useState("");
  const [soloSubject, setSoloSubject] = useState("");
  const [durationChoice, setDurationChoice] = useState("45");
  const [customDuration, setCustomDuration] = useState("30");
  const [creating, setCreating] = useState(false);

  const [brainInput, setBrainInput] = useState("");
  const [brainSubject, setBrainSubject] = useState("General");
  const [generating, setGenerating] = useState(false);
  const [topics, setTopics] = useState<GeneratedTopic[]>([]);
  const [preview, setPreview] = useState<GeneratedTopic | null>(null);

  // Voice-to-text (Web Speech API)
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef("");

  // Image OCR
  const fileRef = useRef<HTMLInputElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* noop */ } }, []);

  const toggleListening = () => {
    if (listening) {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: t("modes.micUnsupported", "Voice input not supported"),
        description: t("modes.micUnsupportedDesc", "Try Chrome or Edge to dictate your thoughts."),
        variant: "destructive",
      });
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    baseTextRef.current = brainInput ? brainInput.trimEnd() + " " : "";
    rec.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      if (final) baseTextRef.current = (baseTextRef.current + final).replace(/\s+/g, " ") + " ";
      setBrainInput((baseTextRef.current + interim).trimStart());
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e?.error !== "aborted") {
        toast({
          title: t("modes.micFailed", "Microphone error"),
          description: e?.error === "not-allowed"
            ? t("modes.micDenied", "Microphone access was blocked in your browser.")
            : String(e?.error ?? ""),
          variant: "destructive",
        });
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: t("modes.imgTooLarge", "Image is too large (max 8 MB)"), variant: "destructive" });
      return;
    }
    setOcrBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the image"));
        reader.readAsDataURL(file);
      });
      const resp = await fetch(OCR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Error ${resp.status}`);
      const extracted = String(data.text ?? "").trim();
      if (!extracted) throw new Error(t("modes.imgNoText", "No readable text found in that image."));
      setBrainInput((prev) => (prev.trim() ? `${prev.trim()}\n\n${extracted}` : extracted));
      toast({ title: t("modes.imgAdded", "Notes added from your image") });
    } catch (e) {
      toast({
        title: t("modes.imgFailed", "Could not read that image"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setOcrBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const soloMinutes = durationChoice === "custom" ? Math.max(5, Math.min(180, Number(customDuration) || 45)) : Number(durationChoice);

  const startEssay = async (topic: string, subject: string, mode: "solo" | "brainstorm", minutes?: number) => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("essays")
      .insert({ student_id: user.id, topic: topic.trim(), subject, classroom_id: null, mode, duration_minutes: minutes ?? null })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: t("modes.couldNotStart"), description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/essay/${data.id}`);
  };

  const generateTopics = async () => {
    if (!brainInput.trim()) return;
    setGenerating(true);
    setTopics([]);
    setPreview(null);
    try {
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ input: brainInput.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Error ${resp.status}`);
      const list: GeneratedTopic[] = Array.isArray(data.topics) ? data.topics : [];
      if (list.length === 0) throw new Error(t("modes.genEmpty"));
      setTopics(list);
    } catch (e) {
      toast({
        title: t("modes.genFailed"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const cards = [
    {
      key: "classroom",
      icon: KeyRound,
      title: t("modes.classroomTitle"),
      desc: t("modes.classroomDesc"),
      badge: t("modes.classroomBadge"),
      accent: "bg-primary/10 text-primary",
      onClick: () => navigate("/join"),
    },
    {
      key: "solo",
      icon: PenLine,
      title: t("modes.soloTitle"),
      desc: t("modes.soloDesc"),
      badge: t("modes.soloBadge"),
      accent: "bg-warning/15 text-warning",
      onClick: () => setSoloOpen(true),
    },
    {
      key: "brainstorm",
      icon: Sparkles,
      title: t("modes.brainTitle"),
      desc: t("modes.brainDesc"),
      badge: t("modes.brainBadge"),
      accent: "bg-success/15 text-success",
      onClick: () => setBrainOpen(true),
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={c.onClick}
              className="group text-left bg-card border border-border rounded-xl p-5 hover:border-primary hover:shadow-md transition-all flex flex-col"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${c.accent}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display font-semibold text-foreground">{c.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground font-display flex-1">{c.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground">
                  {c.badge}
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Solo mode: pre-start info + timer */}
      <Dialog open={soloOpen} onOpenChange={setSoloOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{t("modes.soloTitle")}</DialogTitle>
            <DialogDescription className="font-display">
              {t("modes.soloModalDesc", "Strict practice mode — set your timer and write in one sitting.")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs font-display text-foreground">
                {t("modes.soloRule1", "Strict practice mode. The timer starts as soon as you begin.")}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquareOff className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs font-display text-foreground">
                {t("modes.soloRule2", "No AI chat guidance during writing.")}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs font-display text-foreground">
                {t("modes.soloRule3", "The essay cannot be saved as a draft to finish later.")}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="font-display">{t("join.topic")}</Label>
              <Input
                value={soloTopic}
                onChange={(e) => setSoloTopic(e.target.value)}
                placeholder={t("join.topicPh")}
                autoFocus
              />
            </div>
            <div>
              <Label className="font-display">{t("join.subject")}</Label>
              <Select value={soloSubject} onValueChange={setSoloSubject}>
                <SelectTrigger><SelectValue placeholder={t("join.selectSubject")} /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-display">{t("modes.duration", "Writing time")}</Label>
              <div className="flex gap-2">
                <Select value={durationChoice} onValueChange={setDurationChoice}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {durationChoice === "custom" && (
                  <Input
                    type="number"
                    min={5}
                    max={180}
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    className="w-24"
                  />
                )}
              </div>
            </div>
            <Button
              onClick={() => startEssay(soloTopic, soloSubject, "solo", soloMinutes)}
              disabled={creating || !soloTopic.trim() || !soloSubject}
              className="w-full font-display"
            >
              {creating ? t("common.loading") : `${t("modes.startSolo")} · ${soloMinutes} min`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brainstorm modal */}
      <Dialog open={brainOpen} onOpenChange={(o) => { setBrainOpen(o); if (!o) { setTopics([]); setBrainInput(""); setPreview(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
          <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-success" />
              {t("modes.brainTitle")}
            </DialogTitle>
            <DialogDescription className="font-display">{t("modes.brainModalDesc")}</DialogDescription>
          </DialogHeader>
          </div>

          {preview ? (
            <>
            <div className="space-y-4 overflow-y-auto px-6 py-5 flex-1">
              <button
                onClick={() => setPreview(null)}
                className="flex items-center gap-1 text-xs font-display text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-3.5 h-3.5" />{t("modes.backToTopics", "Back to topics")}
              </button>
              <div>
                <span className="inline-block rounded-full bg-success/15 text-success px-2.5 py-1 text-[10px] uppercase tracking-wider font-display font-bold mb-2">
                  {t("modes.researchBrief", "Topic research brief")}
                </span>
                <h3 className="font-display font-bold text-lg text-foreground">{preview.title}</h3>
                <div className="mt-3 rounded-xl border-l-4 border-success bg-success/10 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-0.5">
                    {t("modes.coreThesis", "Core thesis")}
                  </p>
                  <p className="text-sm font-display text-foreground leading-relaxed">{preview.focus}</p>
                </div>
              </div>
              {preview.background && (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-1">
                    {t("modes.background", "Background & context")}
                  </p>
                  <p className="text-sm font-display text-foreground leading-relaxed">{preview.background}</p>
                </div>
              )}
              {preview.angles && preview.angles.length > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-2">
                    {t("modes.angles", "Key arguments & perspectives to explore")}
                  </p>
                  <ul className="space-y-2">
                    {preview.angles.map((a, i) => (
                      <li key={i} className="text-sm font-display text-foreground flex gap-2">
                        <span className="text-primary">🔹</span>
                        <span>
                          <span className="font-semibold">{a.label}</span>
                          {a.detail ? <span className="text-muted-foreground"> — {a.detail}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.vocabulary && preview.vocabulary.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                  <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-2">
                    {t("modes.vocabulary", "Key vocabulary & terms")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {preview.vocabulary.map((v, i) => (
                      <div
                        key={i}
                        className="rounded-full bg-card border border-warning/40 px-3 py-1.5 text-xs font-display text-foreground"
                      >
                        <span className="font-semibold">{v.term}</span>
                        {v.definition ? <span className="text-muted-foreground"> — {v.definition}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {preview.guiding_question && (
                <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                  <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-1">
                    {t("modes.guidingQuestion", "Suggested guiding question")}
                  </p>
                  <p className="text-sm font-display italic text-foreground leading-relaxed">
                    {preview.guiding_question}
                  </p>
                </div>
              )}
              {preview.facts && preview.facts.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-[10px] uppercase tracking-wide font-display font-semibold text-muted-foreground mb-2">
                    {t("modes.keyFacts", "Key facts")}
                  </p>
                  <ul className="space-y-1.5">
                    {preview.facts.map((f, i) => (
                      <li key={i} className="text-sm font-display text-foreground flex gap-2">
                        <span className="text-success">•</span><span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="border-t border-border bg-card px-6 py-4">
              <Button
                size="lg"
                className="w-full font-display"
                disabled={creating}
                onClick={() => startEssay(preview.title, brainSubject, "brainstorm")}
              >
                {creating ? t("common.loading") : t("modes.startWriting", "Start Writing Essay")}
              </Button>
            </div>
            </>
          ) : (
            <div className="space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <Label className="font-display">{t("modes.brainInputLabel")}</Label>
                <div className="flex flex-wrap gap-2 my-2">
                  {PILLS.map((p) => (
                    <button
                      key={p.text}
                      type="button"
                      onClick={() => setBrainInput(p.text)}
                      className="text-xs font-display rounded-full border border-border bg-muted/50 hover:bg-muted hover:border-success px-3 py-1.5 text-left transition-colors"
                    >
                      {p.emoji} {p.text}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Textarea
                    value={brainInput}
                    onChange={(e) => setBrainInput(e.target.value)}
                    placeholder={t("modes.brainInputPh")}
                    className="min-h-[120px] font-display pb-12"
                    disabled={generating}
                  />
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleListening}
                      disabled={generating}
                      aria-label={listening ? t("modes.micStop", "Stop dictation") : t("modes.micStart", "Dictate your thoughts")}
                      aria-pressed={listening}
                      className={`h-8 w-8 rounded-full border flex items-center justify-center transition-colors ${
                        listening
                          ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
                          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-success"
                      }`}
                    >
                      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={generating || ocrBusy}
                      aria-label={t("modes.imgUpload", "Upload a photo of your notes")}
                      className="h-8 w-8 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-success flex items-center justify-center transition-colors disabled:opacity-60"
                    >
                      {ocrBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    </button>
                    <span className="text-[11px] font-display text-muted-foreground">
                      {listening
                        ? t("modes.micListening", "Listening…")
                        : ocrBusy
                        ? t("modes.imgReading", "Reading your image…")
                        : t("modes.inputHint", "Speak or upload a photo of your notes")}
                    </span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImage(e.target.files?.[0])}
                  />
                </div>
              </div>

              <div>
                <Label className="font-display">{t("join.subject")}</Label>
                <Select value={brainSubject} onValueChange={setBrainSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={generateTopics}
                disabled={generating || !brainInput.trim()}
                className="w-full font-display"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("modes.generating")}</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />{t("modes.generate")}</>
                )}
              </Button>

              {topics.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("modes.pickOne")}
                  </p>
                  {topics.map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => setPreview(topic)}
                      className="w-full text-left bg-muted/50 hover:bg-muted border border-border hover:border-primary rounded-lg p-3 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-display font-semibold text-foreground text-sm mb-1">
                            {topic.title}
                          </h4>
                          <p className="text-xs text-muted-foreground font-display">{topic.focus}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModeCards;
