import { createContext, useContext, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface AreaSwitchContextType {
  effectiveArea: string;
  setEffectiveArea: (area: string) => void;
  isOverriding: boolean;
}

const AreaSwitchContext = createContext<AreaSwitchContextType>({
  effectiveArea: "",
  setEffectiveArea: () => {},
  isOverriding: false,
});

export function AreaSwitchProvider({ children }: { children: ReactNode }) {
  const { profile, role } = useAuth();
  const [overrideArea, setOverrideArea] = useState<string | null>(null);

  const canSwitch = role === "admin";
  const profileArea = profile?.area ?? "";
  const effectiveArea = canSwitch && overrideArea ? overrideArea : profileArea;
  const isOverriding = canSwitch && !!overrideArea && overrideArea !== profileArea;

  return (
    <AreaSwitchContext.Provider value={{
      effectiveArea,
      setEffectiveArea: (area: string) => {
        if (canSwitch) setOverrideArea(area || null);
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
