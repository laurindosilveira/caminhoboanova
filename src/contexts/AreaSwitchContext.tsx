import { createContext, useContext, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AreaSwitchContextType {
  effectiveArea: string;
  setEffectiveArea: (area: string) => Promise<void>;
  isOverriding: boolean;
}

const AreaSwitchContext = createContext<AreaSwitchContextType>({
  effectiveArea: "",
  setEffectiveArea: () => {},
  isOverriding: false,
});

export function AreaSwitchProvider({ children }: { children: ReactNode }) {
  const { user, profile, role, adminArea } = useAuth();
  const [overrideArea, setOverrideArea] = useState<string | null>(null);

  const canSwitch = role === "admin";
  const profileArea = profile?.area ?? "";
  const persistedArea = canSwitch ? (adminArea || profileArea) : profileArea;
  const effectiveArea = canSwitch ? (overrideArea ?? persistedArea) : profileArea;
  const isOverriding = canSwitch && !!overrideArea && overrideArea !== profileArea;

  return (
    <AreaSwitchContext.Provider value={{
      effectiveArea,
      setEffectiveArea: async (area: string) => {
        if (!canSwitch || !user) return;

        const nextArea = area || profileArea;
        setOverrideArea(nextArea);

        const { error } = await supabase
          .from("user_roles")
          .update({ admin_area: nextArea } as any)
          .eq("user_id", user.id)
          .eq("role", "admin");

        if (error) {
          setOverrideArea(adminArea || profileArea);
          throw error;
        }
      },
      isOverriding,
    }}>
      {children}
    </AreaSwitchContext.Provider>
  );
}

export function useAreaSwitch() {
  return useContext(AreaSwitchContext);
}
