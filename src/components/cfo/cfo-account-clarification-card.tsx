"use client";

import { Button } from "@/components/ui/button";

export function CfoAccountClarificationCard({
  question,
  candidates,
  onSelect,
  loading,
}: {
  question: string;
  candidates: Array<{ accountId: string; displayName: string; score: number }>;
  onSelect: (accountId: string) => void;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm">{question}</p>
      <div className="mt-3 flex flex-col gap-2">
        {candidates.map((c) => (
          <Button
            key={c.accountId}
            variant="outline"
            size="sm"
            className="h-auto justify-start py-2 text-left text-xs"
            disabled={loading}
            onClick={() => onSelect(c.accountId)}
          >
            {c.displayName}
          </Button>
        ))}
      </div>
    </div>
  );
}
