"use client";

import { formatMoney } from "@/lib/utils/money";
import { Button } from "@/components/ui/button";
import type { CFODataCommand } from "@/lib/ai/commands/schemas";

interface PreviewData {
  type: string;
  title: string;
  lines: Array<{ label: string; value?: string | number }>;
  recalculates?: string[];
  note?: string;
}

export function CfoUpdateConfirmationCard({
  preview,
  loading,
  onConfirm,
  onCancel,
}: {
  command: CFODataCommand;
  preview: PreviewData;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-fk-gold/40 bg-fk-charcoal/60 p-4">
      <p className="text-sm font-semibold text-fk-gold">{preview.title}</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {preview.lines.map((line) => (
          <li key={line.label} className="flex justify-between gap-2">
            <span className="text-fk-muted">{line.label}</span>
            <span className="font-medium tabular-nums">
              {typeof line.value === "number"
                ? formatMoney(line.value)
                : line.value ?? "—"}
            </span>
          </li>
        ))}
      </ul>
      {preview.note && <p className="mt-2 text-xs text-fk-muted">{preview.note}</p>}
      {preview.recalculates && preview.recalculates.length > 0 && (
        <div className="mt-3 text-xs text-fk-muted">
          <p className="font-medium">This will recalculate:</p>
          <ul className="mt-1 list-disc pl-4">
            {preview.recalculates.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onConfirm} disabled={loading}>
          {loading ? "Updating…" : "Confirm update"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
      <p className="mt-3 text-[10px] text-fk-muted">
        Finance King will always show a preview before changing your records.
      </p>
    </div>
  );
}

export function CfoUpdateResultCard({
  message,
  metricChanges,
  auditId,
  onUndo,
  loading,
}: {
  message: string;
  metricChanges: Array<{ metric: string; before: number; after: number; difference: number }>;
  auditId?: string;
  onUndo?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
      <p className="text-sm font-medium text-emerald-200">{message}</p>
      <p className="mt-1 text-xs text-emerald-200/80">Updated and recalculated.</p>
      {metricChanges.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {metricChanges.map((m) => (
            <li key={m.metric} className="flex justify-between gap-2 text-fk-muted">
              <span>{m.metric}</span>
              <span className="tabular-nums text-fk-foreground">
                {formatMoney(m.before)} → {formatMoney(m.after)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-fk-muted">
        All dashboard cards, charts, and alerts have been refreshed.
      </p>
      {auditId && onUndo && (
        <Button size="sm" variant="ghost" className="mt-3 h-8" onClick={onUndo} disabled={loading}>
          Undo
        </Button>
      )}
    </div>
  );
}
