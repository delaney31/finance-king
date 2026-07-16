"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinancialStateSnapshot, FinancialStateChangedEvent } from "@/lib/financial-state/types";
import { FINANCIAL_STATE_CHANGED_EVENT } from "@/lib/financial-state/types";

interface FinancialStateContextValue {
  snapshot: FinancialStateSnapshot;
  loading: boolean;
  refresh: () => Promise<void>;
  notifyChanged: (event: FinancialStateChangedEvent) => void;
}

const FinancialStateContext = createContext<FinancialStateContextValue | null>(null);

export function FinancialStateProvider({
  children,
  initialSnapshot,
}: {
  children: React.ReactNode;
  initialSnapshot: FinancialStateSnapshot;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/financial-state");
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }, [router]);

  const notifyChanged = useCallback(
    (event: FinancialStateChangedEvent) => {
      window.dispatchEvent(new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT, { detail: event }));
      void refresh();
    },
    [refresh]
  );

  return (
    <FinancialStateContext.Provider value={{ snapshot, loading, refresh, notifyChanged }}>
      {children}
    </FinancialStateContext.Provider>
  );
}

export function useFinancialState() {
  const ctx = useContext(FinancialStateContext);
  if (!ctx) throw new Error("useFinancialState must be used within FinancialStateProvider");
  return ctx;
}
