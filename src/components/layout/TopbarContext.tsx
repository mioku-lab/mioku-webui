import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export interface TopbarContextValue {
  leftContent: ReactNode;
  setLeftContent: (content: ReactNode) => void;
}

export const TopbarContext = createContext<TopbarContextValue | null>(null);

export function useTopbar() {
  const ctx = useContext(TopbarContext);
  if (!ctx) {
    throw new Error("useTopbar must be used inside TopbarContext.Provider");
  }
  return ctx;
}
