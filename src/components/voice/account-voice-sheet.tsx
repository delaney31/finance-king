"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, MicOff, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useVoiceInput } from "@/lib/voice/use-voice-input";
import { FINANCIAL_STATE_CHANGED_EVENT } from "@/lib/financial-state/types";
import { formatMoney } from "@/lib/utils/money";
import { getSuggestedPhrases } from "@/lib/voice-financial/preview";
import type { VoiceFinancialCommand } from "@/lib/voice-financial/schemas";
import { useVoiceFinancial } from "./voice-financial-provider";
import { VoiceFinancialConfirmation } from "./voice-financial-confirmation";

export function AccountVoiceSheet() {
  const { isOpen, closeVoiceSheet, contextAccount } = useVoiceFinancial();
  const voice = useVoiceInput();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    command: VoiceFinancialCommand;
    preview: Parameters<typeof VoiceFinancialConfirmation>[0]["preview"];
  } | null>(null);
  const [result, setResult] = useState<{
    message: string;
    metricChanges: Array<{ metric: string; before: number; after: number }>;
    auditId?: string;
  } | null>(null);

  const reset = useCallback(() => {
    setPending(null);
    setResult(null);
    setError(null);
    voice.reset();
  }, [voice]);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const handleReview = async () => {
    const transcript = voice.transcript.trim();
    if (!transcript) {
      setError("Please speak or type a transaction first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/voice-financial/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          contextAccountId: contextAccount?.accountId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      if (data.command.missingFields?.length > 0 && data.clarificationQuestion) {
        setError(data.clarificationQuestion);
        return;
      }
      if (data.needsConfirmation && data.preview) {
        setPending({ command: data.command, preview: data.preview });
      } else {
        setError(data.command.warnings?.[0] ?? "Could not parse this activity.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/voice-financial/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: pending.command }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Apply failed");
      setPending(null);
      setResult({
        message: data.message,
        metricChanges: data.metricChanges ?? [],
        auditId: data.auditId,
      });
      window.dispatchEvent(new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!result?.auditId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/voice-financial/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId: result.auditId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResult(null);
      window.dispatchEvent(new CustomEvent(FINANCIAL_STATE_CHANGED_EVENT));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setLoading(false);
    }
  };

  const phrases = contextAccount
    ? getSuggestedPhrases(contextAccount.accountType)
    : getSuggestedPhrases("CHECKING");

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && closeVoiceSheet()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto md:side-right">
        <SheetHeader>
          <SheetTitle>
            {contextAccount ? `Update ${contextAccount.nickname}` : "Record activity by voice"}
          </SheetTitle>
          {contextAccount && (
            <p className="text-sm text-fk-muted">
              {contextAccount.institution}
              {contextAccount.accountLastFour ? ` ••••${contextAccount.accountLastFour}` : ""}
              {" · "}
              {formatMoney(contextAccount.currentBalance)}
            </p>
          )}
        </SheetHeader>

        <div className="space-y-4 p-4 pt-0">
          {!pending && !result && (
            <>
              <p className="text-xs text-fk-muted">
                Updates are always reviewed before they change your account.
              </p>

              <div className="flex flex-col items-center gap-3 py-4">
                {voice.isSupported ? (
                  <Button
                    type="button"
                    size="lg"
                    variant={voice.isListening ? "default" : "outline"}
                    className={`h-16 w-16 rounded-full ${voice.isListening ? "animate-pulse bg-red-500/20" : ""}`}
                    onClick={voice.toggleListening}
                    onPointerDown={(e) => {
                      if (e.button === 0 && e.pointerType === "touch") voice.startListening();
                    }}
                    onPointerUp={() => {
                      if (voice.isListening) voice.stopListening();
                    }}
                    aria-label={voice.isListening ? "Tap to stop listening" : "Tap to start voice input"}
                  >
                    {voice.isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                ) : (
                  <p className="text-sm text-amber-400">Voice input is not supported in this browser. Type below.</p>
                )}
                <p className="text-xs text-fk-muted">
                  {voice.isListening ? "Listening… Tap to stop" : voice.stateLabel || "Tap or hold to speak"}
                </p>
              </div>

              <div className="rounded-lg border border-fk-border/60 bg-fk-charcoal/40 p-3">
                <p className="text-xs text-fk-muted">Transcript</p>
                <textarea
                  className="mt-1 w-full resize-none bg-transparent text-sm outline-none"
                  rows={3}
                  value={voice.transcript}
                  onChange={(e) => voice.setTranscript(e.target.value)}
                  placeholder="Speak or type your transaction…"
                  aria-label="Edit voice transcript"
                />
                {(voice.transcript || voice.state === "READY") && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={voice.startListening}>
                      <RotateCcw className="mr-1 h-3 w-3" /> Record again
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={voice.cancel}>
                      <X className="mr-1 h-3 w-3" /> Cancel recording
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-fk-muted">Try saying:</p>
                <ul className="space-y-1">
                  {phrases.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        className="text-left text-xs text-fk-gold/80 hover:text-fk-gold"
                        onClick={() => voice.setTranscript(p)}
                      >
                        &ldquo;{p}&rdquo;
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleReview} disabled={loading || !voice.transcript.trim()}>
                  {loading ? "Parsing…" : "Review update"}
                </Button>
                <Button variant="outline" onClick={closeVoiceSheet}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {pending && (
            <VoiceFinancialConfirmation
              preview={pending.preview}
              loading={loading}
              warnings={pending.command.warnings}
              isNewPayee={pending.command.isNewPayee}
              payeeName={pending.command.payeeName}
              onConfirm={handleConfirm}
              onCancel={() => setPending(null)}
            />
          )}

          {result && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-medium text-emerald-200">{result.message}</p>
              {result.metricChanges.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {result.metricChanges.slice(0, 4).map((m) => (
                    <li key={m.metric} className="flex justify-between text-fk-muted">
                      <span>{m.metric}</span>
                      <span className="tabular-nums">
                        {formatMoney(m.before)} → {formatMoney(m.after)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-fk-muted">
                Updated: account balance, transaction activity, calendar, dashboard, forecasts
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {contextAccount && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/accounts/${contextAccount.accountId}`}>View account activity</a>
                  </Button>
                )}
                {result.auditId && (
                  <Button size="sm" variant="ghost" onClick={handleUndo} disabled={loading}>
                    Undo
                  </Button>
                )}
                <Button size="sm" onClick={closeVoiceSheet}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-amber-400">{error}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
