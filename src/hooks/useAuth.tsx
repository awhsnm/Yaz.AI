import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "teacher" | "student" | "admin" | null;
export type BetaStatus = "loading" | "active" | "disabled" | "not_invited" | "unauthenticated";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role;
  isAdmin: boolean;
  betaStatus: BetaStatus;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  role: null,
  isAdmin: false,
  betaStatus: "loading",
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [betaStatus, setBetaStatus] = useState<BetaStatus>("loading");
  const [loading, setLoading] = useState(true);

  const hydrate = async (u: User) => {
    const [{ data: profile }, { data: admin }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", u.id).maybeSingle(),
      supabase.rpc("is_admin", { _user_id: u.id }),
    ]);
    setIsAdmin(admin === true);
    setRole((profile?.role as Role) ?? "student");

    if (u.email_confirmed_at) {
      const { data: status } = await supabase.rpc("record_beta_login", {
        _user_agent: navigator.userAgent.slice(0, 400),
      });
      setBetaStatus(((status as string) ?? "not_invited") as BetaStatus);
    } else {
      setBetaStatus("not_invited");
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { void hydrate(s.user); }, 0);
      } else {
        setRole(null);
        setIsAdmin(false);
        setBetaStatus("unauthenticated");
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await hydrate(s.user);
      } else {
        setBetaStatus("unauthenticated");
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <Ctx.Provider value={{ user, session, role, isAdmin, betaStatus, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
