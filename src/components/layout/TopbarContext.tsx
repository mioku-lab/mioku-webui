import { createContext, use } from "react";
import type { ReactNode } from "react";

export interface TopbarContextValue {
  leftContent: ReactNode;
  setLeftContent: (content: ReactNode) => void;
  centerContent: ReactNode;
  setCenterContent: (content: ReactNode) => void;
  rightContent: ReactNode;
  setRightContent: (content: ReactNode) => void;
  denseHeader: boolean;
  setDenseHeader: (dense: boolean) => void;
}

export const TopbarContext = createContext<TopbarContextValue | null>(null);

export function useTopbar() {
  const ctx = use(TopbarContext);
  if (!ctx) {
    throw new Error("useTopbar must be used inside TopbarContext.Provider");
  }
  return ctx;
}
