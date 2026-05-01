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
  enrollment_status?: "pending" | "approved" | "rejected";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: "user" | "admin" | "lider" | null;
  adminArea: string | null;
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
  adminArea: null,
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
  const [adminArea, setAdminArea] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchProfileAndRole(userId: string) {
    const [profileRes, isAdminRes, isLiderRes, isSuperRes, roleRowsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "lider" }),
      supabase.rpc("is_super_admin", { _user_id: userId }),
      supabase.from("user_roles").select("role, admin_area").eq("user_id", userId).in("role", ["admin", "lider"]),
    ]);
    setProfile(profileRes.data ?? null);
    setIsSuper(isSuperRes.data === true);
    const roleRows = roleRowsRes.data ?? [];
    const selectedRoleRow = roleRows.find((row) => row.role === "admin") ?? roleRows[0] ?? null;
    setAdminArea(selectedRoleRow?.admin_area ?? null);
    if (!isAdminRes.error && !isLiderRes.error) {
      if (isAdminRes.data === true) setRole("admin");
      else if (isLiderRes.data === true) setRole("lider");
      else setRole("user");
    }
  }

  useEffect(() => {
    // Track whether the initial profile fetch has been started to avoid
    // running it twice (once from INITIAL_SESSION, once from getSession).
    let initialFetchDone = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (!currentSession?.user) {
          // Signed out
          setProfile(null);
          setRole(null);
          setAdminArea(null);
          setLoading(false);
          return;
        }

        // TOKEN_REFRESHED only updates the session token — profile/role data
        // hasn't changed, so skip the 5-query re-fetch to avoid UI re-renders.
        if (event === "TOKEN_REFRESHED") {
          return;
        }

        // SIGNED_IN / INITIAL_SESSION / USER_UPDATED → fetch profile
        // Use setTimeout to avoid Supabase auth callback deadlock.
        if (!initialFetchDone || event === "SIGNED_IN") {
          initialFetchDone = true;
          setTimeout(() => {
            fetchProfileAndRole(currentSession.user.id).finally(() => setLoading(false));
          }, 0);
        }
      }
    );

    // getSession covers the case where INITIAL_SESSION never fires (some browsers).
    // The initialFetchDone flag prevents a double fetch when both paths run.
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession?.user && !initialFetchDone) {
        initialFetchDone = true;
        setSession(currentSession);
        setUser(currentSession.user);
        fetchProfileAndRole(currentSession.user.id).finally(() => setLoading(false));
      } else if (!currentSession?.user) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setAdminArea(null);
    setIsSuper(false);
  }

  async function refreshProfile() {
    const currentUser = user;
    if (currentUser?.id) {
      await fetchProfileAndRole(currentUser.id);
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, role, adminArea, isSuper, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
