import { useEffect, useState } from "react";
import { Settings as SettingsIcon, User, Sliders, LifeBuoy, Sun, Moon, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useSettings, type Theme, type TextSize, type Lang } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const UserMenu = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { theme, setTheme, textSize, setTextSize, lang, setLang } = useSettings();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [bug, setBug] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, birthday")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setBirthday(data.birthday ?? "");
      }
    })();
  }, [open, user]);

  const saveAccount = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName || null, birthday: birthday || null })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: t("settings.saved") });
  };

  const sendBug = async () => {
    if (!user || !bug.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("bug_reports")
      .insert({ user_id: user.id, message: bug.trim() });
    setBusy(false);
    if (error) return toast({ title: t("settings.bugFailed"), description: error.message, variant: "destructive" });
    setBug("");
    toast({ title: t("settings.bugSent") });
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={t("common.settings")}>
        <SettingsIcon className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{t("settings.title")}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="account">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="account"><User className="w-3.5 h-3.5 mr-1.5" />{t("settings.account")}</TabsTrigger>
              <TabsTrigger value="core"><Sliders className="w-3.5 h-3.5 mr-1.5" />{t("settings.core")}</TabsTrigger>
              <TabsTrigger value="support"><LifeBuoy className="w-3.5 h-3.5 mr-1.5" />{t("settings.support")}</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-3 pt-3">
              <div>
                <Label className="font-display">{t("settings.fullName")}</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label className="font-display">{t("settings.birthday")}</Label>
                <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
              </div>
              <Button onClick={saveAccount} disabled={busy} className="w-full">{t("settings.saveChanges")}</Button>
            </TabsContent>

            <TabsContent value="core" className="space-y-4 pt-3">
              <div>
                <Label className="font-display block mb-2">{t("settings.appearance")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["light", "dark"] as Theme[]).map((th) => (
                    <button
                      key={th}
                      onClick={() => setTheme(th)}
                      className={`flex items-center justify-center gap-2 border rounded-md px-3 py-2 text-sm font-display transition-colors ${theme === th ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
                    >
                      {th === "light" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      {t(`settings.${th}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="font-display block mb-2">{t("settings.textSize")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["small", "medium", "large"] as TextSize[]).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setTextSize(sz)}
                      className={`border rounded-md px-3 py-2 text-sm font-display transition-colors ${textSize === sz ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
                    >
                      {t(`settings.${sz}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="font-display block mb-2">{t("settings.language")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["en", "ru", "kk"] as Lang[]).map((lg) => (
                    <button
                      key={lg}
                      onClick={() => setLang(lg)}
                      className={`border rounded-md px-3 py-2 text-sm font-display transition-colors ${lang === lg ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
                    >
                      {lg === "en" ? t("settings.english") : lg === "ru" ? t("settings.russian") : t("settings.kazakh")}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="support" className="space-y-3 pt-3">
              <div>
                <Label className="font-display font-semibold">{t("settings.bugTitle")}</Label>
                <p className="text-xs text-muted-foreground font-display mt-1 mb-2">{t("settings.bugLabel")}</p>
                <Textarea
                  value={bug}
                  onChange={(e) => setBug(e.target.value)}
                  placeholder={t("settings.bugPh")}
                  rows={5}
                />
              </div>
              <Button onClick={sendBug} disabled={busy || !bug.trim()} className="w-full">{t("settings.bugSend")}</Button>
            </TabsContent>
          </Tabs>

          <div className="border-t border-border pt-3 mt-2 flex items-center justify-between text-xs text-muted-foreground font-display">
            <span className="truncate">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-xs h-7">
              <LogOut className="w-3.5 h-3.5 mr-1" />{t("common.signOut")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserMenu;