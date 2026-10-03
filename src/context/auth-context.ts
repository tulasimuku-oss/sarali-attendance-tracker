import { createContext, useContext } from "react";
import type { StudioState } from "../lib/demo";

export type AuthContextValue = {
  studio: StudioState;
  loading: boolean;
  setStudio: (studio: StudioState) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
