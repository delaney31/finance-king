"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface CFOContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const CFOContext = createContext<CFOContextValue | null>(null);

export function AskMyCfoProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <CFOContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </CFOContext.Provider>
  );
}

export function useAskMyCfo() {
  const ctx = useContext(CFOContext);
  if (!ctx) throw new Error("useAskMyCfo must be used within AskMyCfoProvider");
  return ctx;
}
