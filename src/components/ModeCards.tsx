import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, PenLine, Sparkles, Loader2, ArrowRight } from "lucide-react";
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

type GeneratedTopic = { title: string; focus: string };

const ModeCards = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [soloOpen, setSoloOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [soloTopic, setSoloTopic] = useState("");
  const [soloSubject, setSoloSubject] = useState("");
  const [creating, setCreating] = useState(false);

  const [brainInput, setBrainInput] = useState("");
  const [brainSubject, setBrainSubject] = useState("General");
  const [generating, setGenerating] = useState(false);
  const [topics, setTopics] = useState<GeneratedTopic[]>([]);

  const startEssay = async (topic: string, subject: string, mode: "solo" | "brainstorm") => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("essays")
      .insert({ student_id: user.id, topic: topic.trim(), subject, classroom_id: null, mode })
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

      {/* Solo mode modal */}
      <Dialog open={soloOpen} onOpenChange={setSoloOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{t("modes.soloTitle")}</DialogTitle>
            <DialogDescription className="font-display">{t("modes.soloModalDesc")}</DialogDescription>
          </DialogHeader>
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
            <Button
              onClick={() => startEssay(soloTopic, soloSubject, "solo")}
              disabled={creating || !soloTopic.trim() || !soloSubject}
              className="w-full font-display"
            >
              {creating ? t("common.loading") : t("modes.startSolo")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brainstorm modal */}
      <Dialog open={brainOpen} onOpenChange={(o) => { setBrainOpen(o); if (!o) { setTopics([]); setBrainInput(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-success" />
              {t("modes.brainTitle")}
            </DialogTitle>
            <DialogDescription className="font-display">{t("modes.brainModalDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="font-display">{t("modes.brainInputLabel")}</Label>
              <Textarea
                value={brainInput}
                onChange={(e) => setBrainInput(e.target.value)}
                placeholder={t("modes.brainInputPh")}
                className="min-h-[120px] font-display"
                disabled={generating}
              />
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
                    onClick={() => startEssay(topic.title, brainSubject, "brainstorm")}
                    disabled={creating}
                    className="w-full text-left bg-muted/50 hover:bg-muted border border-border hover:border-primary rounded-lg p-3 transition-all group disabled:opacity-50"
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
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModeCards;