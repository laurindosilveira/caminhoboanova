import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  birth_date: string;
  phone: string;
  community: string;
  area: string;
  turma_id?: string | null;
  father_name?: string;
  mother_name?: string;
  father_phone?: string;
  mother_phone?: string;
  address?: string;
  avatar_url?: string;
  confirmation_year?: number | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: "user" | "admin" | "lider" | null;
  isSuper: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  isSuper: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<"user" | "admin" | "lider" | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchProfileAndRole(userId: string) {
    const [profileRes, isAdminRes, isLiderRes, isSuperRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "lider" }),
      supabase.rpc("is_super_admin", { _user_id: userId }),
    ]);
    setProfile(profileRes.data ?? null);
    setIsSuper(isSuperRes.data === true);
    if (!isAdminRes.error && !isLiderRes.error) {
      if (isAdminRes.data === true) setRole("admin");
      else if (isLiderRes.data === true) setRole("lider");
      else setRole("user");
    }
  }

  useEffect(() => {
    // Set up auth state listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          // Use setTimeout to avoid deadlock with Supabase auth callbacks
          setTimeout(() => {
            fetchProfileAndRole(currentSession.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        fetchProfileAndRole(currentSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setIsSuper(false);
  }

  async function refreshProfile() {
    const currentUser = user;
    if (currentUser?.id) {
      await fetchProfileAndRole(currentUser.id);
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isSuper, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
