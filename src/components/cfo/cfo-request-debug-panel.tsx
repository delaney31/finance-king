"use client";

import type { CFORequestState } from "./use-cfo-request";
import { STATE_LABELS } from "./use-cfo-request";

export function CfoRequestDebugPanel({
  requestId,
  state,
}: {
  requestId: string | null;
  state: CFORequestState;
}) {
  if (!requestId) return null;

  return (
    <div className="rounded-lg border border-dashed border-fk-border/60 bg-fk-charcoal/30 p-2 text-[10px] text-fk-muted">
      <p className="font-mono">request: {requestId.slice(0, 8)}…</p>
      <p>state: {state}</p>
      <p>label: {STATE_LABELS[state] || "—"}</p>
    </div>
  );
}
