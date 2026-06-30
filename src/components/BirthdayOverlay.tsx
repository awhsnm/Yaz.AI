import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";

const SESSION_KEY = "bday-shown";

export const BirthdayOverlay = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("birthday").eq("id", user.id).maybeSingle();
      if (!data?.birthday) return;
      const today = new Date();
      const [, m, d] = data.birthday.split("-").map(Number);
      if (m === today.getMonth() + 1 && d === today.getDate()) {
        const key = `${SESSION_KEY}-${user.id}-${today.toDateString()}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        setShow(true);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!show) return;
    const end = Date.now() + 2500;
    const fire = () => {
      confetti({ particleCount: 60, spread: 70, origin: { x: Math.random(), y: 0.3 } });
      if (Date.now() < end) requestAnimationFrame(fire);
    };
    fire();
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-10 shadow-xl text-center max-w-md mx-4 animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <PartyPopper className="w-8 h-8 text-primary" />
        </div>
        <h2 className="font-display font-bold text-3xl text-foreground mb-2">{t("bday.title")}</h2>
        <p className="font-display text-muted-foreground mb-6">{t("bday.msg")}</p>
        <Button onClick={() => setShow(false)} className="w-full">{t("bday.dismiss")}</Button>
      </div>
    </div>
  );
};

export default BirthdayOverlay;