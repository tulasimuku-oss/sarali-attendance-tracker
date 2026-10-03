import { useMemo, useState, type ReactNode } from "react";
import { ensureLocalStudio, updateDemo, type StudioState } from "../lib/demo";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [studio, setStudioState] = useState<StudioState>(() => ensureLocalStudio());

  const value = useMemo(
    () => ({
      studio,
      loading: false,
      setStudio: (next: StudioState) => {
        setStudioState(next);
        updateDemo(next);
      },
    }),
    [studio]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
