"use client";

import type { SpeechRecognitionDiagnostics, VoiceInputState } from "@/lib/voice/types";

export function VoiceDiagnosticsPanel({
  state,
  diagnostics,
  elapsedMs,
}: {
  state: VoiceInputState;
  diagnostics: SpeechRecognitionDiagnostics | null;
  elapsedMs: number;
}) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <details className="rounded border border-dashed border-fk-border/50 p-2 text-[10px] text-fk-muted">
      <summary className="cursor-pointer font-medium">Voice diagnostics</summary>
      <dl className="mt-2 space-y-1">
        <Row label="Browser" value={getBrowserLabel()} />
        <Row label="State" value={state} />
        <Row label="Elapsed" value={`${Math.round(elapsedMs / 1000)}s`} />
        <Row label="Recognition exists" value={diagnostics?.recognitionExists ? "yes" : "no"} />
        <Row label="Session active" value={diagnostics?.sessionActive ? "yes" : "no"} />
        <Row label="Restart count" value={String(diagnostics?.restartCount ?? 0)} />
        <Row label="Last event" value={diagnostics?.lastEvent ?? "—"} />
        <Row label="Last error" value={diagnostics?.lastError ?? "—"} />
        <Row
          label="Silence remaining"
          value={
            diagnostics?.silenceRemainingMs != null
              ? `${Math.round(diagnostics.silenceRemainingMs / 1000)}s`
              : "—"
          }
        />
      </dl>
    </details>
  );
}

function getBrowserLabel(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua)) return "Chrome";
  return ua.slice(0, 40);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
