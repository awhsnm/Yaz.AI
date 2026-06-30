import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupRole, setSignupRole] = useState<"student" | "teacher">("student");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      navigate(role === "teacher" ? "/teacher-dashboard" : "/student-dashboard", { replace: true });
    }
  }, [user, role, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast({ title: t("auth.loginFailed"), description: error.message, variant: "destructive" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, role: signupRole },
      },
    });
    setBusy(false);
    if (error) {
      toast({ title: t("auth.signupFailed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("auth.accountCreated"), description: t("auth.accountCreatedDesc") });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">{t("auth.appName")}</h1>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full mb-5">
              <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <Label htmlFor="li-email">{t("auth.email")}</Label>
                  <Input id="li-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="li-pw">{t("auth.password")}</Label>
                  <Input id="li-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  <Lock className="w-4 h-4 mr-2" />
                  {busy ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3">
                <div>
                  <Label htmlFor="su-name">{t("auth.fullName")}</Label>
                  <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="su-email">{t("auth.email")}</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="su-pw">{t("auth.password")}</Label>
                  <Input id="su-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">{t("auth.iAmA")}</Label>
                  <RadioGroup
                    value={signupRole}
                    onValueChange={(v) => setSignupRole(v as "student" | "teacher")}
                    className="grid grid-cols-2 gap-2"
                  >
                    <label className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer ${signupRole === "student" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <RadioGroupItem value="student" />
                      <GraduationCap className="w-4 h-4" /> {t("auth.student")}
                    </label>
                    <label className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer ${signupRole === "teacher" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <RadioGroupItem value="teacher" />
                      <BookOpen className="w-4 h-4" /> {t("auth.teacher")}
                    </label>
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? t("auth.creating") : t("auth.createAccount")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;