"use client";

import { Button } from "@/components/ui/button";

type PreviewLine = { label: string; value?: string | number };

export function VoiceFinancialConfirmation({
  preview,
  loading,
  warnings,
  isNewPayee,
  payeeName,
  onConfirm,
  onCancel,
}: {
  preview: {
    title: string;
    lines: PreviewLine[];
    note?: string;
  };
  loading?: boolean;
  warnings?: string[];
  isNewPayee?: boolean;
  payeeName?: string;
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
            <span className="text-right font-medium tabular-nums">{line.value ?? "—"}</span>
          </li>
        ))}
      </ul>
      {isNewPayee && payeeName && (
        <p className="mt-2 text-xs text-fk-gold">
          I found a new payee named {payeeName}. Save {payeeName} for future transactions?
        </p>
      )}
      {warnings && warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-400">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {preview.note && <p className="mt-2 text-xs text-fk-muted">{preview.note}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onConfirm} disabled={loading}>
          {loading ? "Applying…" : "Confirm and recalculate"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
