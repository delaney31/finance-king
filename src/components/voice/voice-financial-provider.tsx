"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type VoiceAccountContext = {
  accountId: string;
  nickname: string;
  institution: string;
  accountType: string;
  accountLastFour?: string | null;
  currentBalance: number;
};

type VoiceFinancialContextValue = {
  openVoiceSheet: (account?: VoiceAccountContext) => void;
  closeVoiceSheet: () => void;
  isOpen: boolean;
  contextAccount: VoiceAccountContext | null;
};

const VoiceFinancialContext = createContext<VoiceFinancialContextValue | null>(null);

export function VoiceFinancialProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextAccount, setContextAccount] = useState<VoiceAccountContext | null>(null);

  const openVoiceSheet = useCallback((account?: VoiceAccountContext) => {
    setContextAccount(account ?? null);
    setIsOpen(true);
  }, []);

  const closeVoiceSheet = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <VoiceFinancialContext.Provider
      value={{ openVoiceSheet, closeVoiceSheet, isOpen, contextAccount }}
    >
      {children}
    </VoiceFinancialContext.Provider>
  );
}

export function useVoiceFinancial() {
  const ctx = useContext(VoiceFinancialContext);
  if (!ctx) throw new Error("useVoiceFinancial must be used within VoiceFinancialProvider");
  return ctx;
}
