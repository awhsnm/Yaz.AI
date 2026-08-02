import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, GraduationCap, Lock, Building2, School, ArrowLeft, ChevronRight, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LanguageSelector from "@/components/LanguageSelector";
import SchoolAccessModal from "@/components/SchoolAccessModal";
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
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("login");
  const [signupRole, setSignupRole] = useState<"student" | "teacher" | null>(null);
  const [schoolOpen, setSchoolOpen] = useState(false);

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
        data: { full_name: fullName },
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
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
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
          <Tabs value={tab} onValueChange={setTab}>
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
                <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />{t("auth.teacherPortal")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t("auth.teacherNote")}</p>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <AnimatePresence mode="wait">
                {signupRole === null && (
                  <motion.div
                    key="role"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className="space-y-3"
                  >
                    <div className="text-center mb-1">
                      <h2 className="text-base font-semibold font-display text-foreground">{t("auth.chooseRole")}</h2>
                      <p className="text-xs text-muted-foreground mt-1">{t("auth.chooseRoleSub")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSignupRole("student")}
                      className="w-full text-left rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors p-4 flex items-start gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{t("auth.roleStudentTitle")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("auth.roleStudentDesc")}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-1" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupRole("teacher")}
                      className="w-full text-left rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors p-4 flex items-start gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <School className="w-5 h-5 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{t("auth.roleTeacherTitle")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("auth.roleTeacherDesc")}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-1" />
                    </button>
                  </motion.div>
                )}

                {signupRole === "student" && (
                  <motion.form
                    key="student"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    onSubmit={handleSignup}
                    className="space-y-3"
                  >
                    <button
                      type="button"
                      onClick={() => setSignupRole(null)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      {t("auth.changeRole")}
                    </button>
                    <h2 className="text-base font-semibold font-display text-foreground">{t("auth.studentSignupTitle")}</h2>
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
                    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                      <GraduationCap className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{t("auth.studentSignupNote")}</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? t("auth.creating") : t("auth.createAccount")}
                    </Button>
                  </motion.form>
                )}

                {signupRole === "teacher" && (
                  <motion.div
                    key="teacher"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className="space-y-3"
                  >
                    <button
                      type="button"
                      onClick={() => setSignupRole(null)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      {t("auth.changeRole")}
                    </button>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{t("auth.schoolManagedTitle")}</p>
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t("auth.schoolManagedBody")}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{t("auth.haveCredentials")}</p>
                      <Button className="w-full" onClick={() => { setSignupRole(null); setTab("login"); }}>
                        <Lock className="w-4 h-4 mr-2" />
                        {t("auth.goTeacherLogin")}
                      </Button>
                    </div>
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-muted-foreground">{t("auth.wantIntroduce")}</p>
                      <Button variant="outline" className="w-full" onClick={() => setSchoolOpen(true)}>
                        <Mail className="w-4 h-4 mr-2" />
                        {t("auth.requestAccess")}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
      <SchoolAccessModal open={schoolOpen} onOpenChange={setSchoolOpen} />
    </div>
  );
};

export default Auth;