"use client";

import type { CFOAssistantResponse } from "@/lib/ai/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const RECOMMENDATION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  PROCEED: { label: "Proceed", variant: "default" },
  PROCEED_WITH_LIMIT: { label: "Proceed with limit", variant: "secondary" },
  DELAY: { label: "Delay", variant: "secondary" },
  DECLINE: { label: "Decline", variant: "destructive" },
  INFORMATION_ONLY: { label: "Information", variant: "secondary" },
};

function formatMoney(n?: number) {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CfoResultCard({
  response,
  intent,
  snapshotStale,
  onRecalculate,
  onSimulateAmount,
}: {
  response: CFOAssistantResponse;
  intent?: string;
  snapshotStale?: boolean;
  onRecalculate?: () => void;
  onSimulateAmount?: (amount: number) => void;
}) {
  const [showCalc, setShowCalc] = useState(false);
  const rec = RECOMMENDATION_LABELS[response.recommendation] ?? RECOMMENDATION_LABELS.INFORMATION_ONLY;

  return (
    <div className="space-y-3">
      {snapshotStale && (
        <Card className="border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          Your financial data has changed since this answer was generated.{" "}
          {onRecalculate && (
            <button type="button" onClick={onRecalculate} className="font-medium text-fk-gold underline">
              Recalculate?
            </button>
          )}
        </Card>
      )}

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-fk-muted">Direct answer</p>
        <p className="mt-1 text-sm leading-relaxed">{response.answer}</p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-fk-muted">Recommendation</p>
          <Badge variant={rec.variant}>{rec.label}</Badge>
        </div>
        {intent && <p className="mt-1 text-xs text-fk-muted">Intent: {intent.replace(/_/g, " ")}</p>}
      </Card>

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-fk-muted">Safe to spend</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-fk-muted">Today</p>
            <p className="font-semibold text-fk-gold">{formatMoney(response.safeToSpendToday)}</p>
          </div>
          <div>
            <p className="text-xs text-fk-muted">Week</p>
            <p className="font-semibold">{formatMoney(response.safeToSpendThisWeek)}</p>
          </div>
          <div>
            <p className="text-xs text-fk-muted">Month</p>
            <p className="font-semibold">{formatMoney(response.safeToSpendThisMonth)}</p>
          </div>
        </div>
      </Card>

      {(response.monthEndImpact != null || response.yearEndImpact != null) && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-fk-muted">Financial impact</p>
          <div className="mt-2 space-y-1 text-sm">
            {response.recommendedAmount != null && (
              <p>Cost: {formatMoney(response.recommendedAmount)}</p>
            )}
            {response.monthEndImpact != null && (
              <p>Month-end buffer after: {formatMoney(response.monthEndImpact)}</p>
            )}
            {response.yearEndImpact != null && (
              <p>Year-end buffer after: {formatMoney(response.yearEndImpact)}</p>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-fk-muted">Protection check</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li className={cn(!response.emergencyReserveAffected && "text-green-400")}>
            Emergency fund protected: {response.emergencyReserveAffected ? "At risk" : "Yes"}
          </li>
          <li className={cn(!response.taxReserveAffected && "text-green-400")}>
            Tax reserve protected: {response.taxReserveAffected ? "At risk" : "Yes"}
          </li>
          <li className={cn(response.nextBillsCovered && "text-green-400")}>
            Next major bills funded: {response.nextBillsCovered ? "Yes" : "Review needed"}
          </li>
        </ul>
      </Card>

      {response.warnings.length > 0 && (
        <Card className="border-amber-500/30 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-400">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
            {response.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      {response.assumptions.length > 0 && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-fk-muted">Assumptions</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-fk-muted">
            {response.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium"
          onClick={() => setShowCalc((s) => !s)}
        >
          How this was calculated
          {showCalc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showCalc && (
          <ul className="mt-3 space-y-2 border-t border-fk-border pt-3 text-sm">
            {response.supportingCalculations.map((c, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-fk-muted">{c.label}</span>
                <span>{c.amount != null ? formatMoney(c.amount) : c.description ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {onSimulateAmount && (
        <Card className="p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-fk-muted">Simulate another amount</p>
          <div className="flex flex-wrap gap-2">
            {[50, 100, 250, 500, 1000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => onSimulateAmount(amt)}
                className="rounded-md border border-fk-border px-3 py-1 text-sm hover:bg-fk-charcoal"
              >
                ${amt}
              </button>
            ))}
          </div>
        </Card>
      )}

      {response.suggestedFollowUpQuestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-fk-muted">Suggested follow-ups</p>
          {response.suggestedFollowUpQuestions.slice(0, 3).map((q) => (
            <p key={q} className="text-xs text-fk-muted">• {q}</p>
          ))}
        </div>
      )}
    </div>
  );
}
