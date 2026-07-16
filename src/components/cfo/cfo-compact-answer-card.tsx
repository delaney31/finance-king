"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Crown,
  HelpCircle,
  XCircle,
} from "lucide-react";
import type { CFOAssistantResponse, CFOCompactAnswer } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const DETAILS_PREF_KEY = "cfo-details-expanded";

const STATUS_STYLES = {
  SAFE: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    icon: CheckCircle2,
  },
  CAUTION: {
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    icon: AlertTriangle,
  },
  RISK: {
    ring: "ring-red-500/30",
    bg: "bg-red-500/10",
    text: "text-red-400",
    icon: XCircle,
  },
  UNKNOWN: {
    ring: "ring-fk-border",
    bg: "bg-fk-charcoal/50",
    text: "text-fk-muted",
    icon: HelpCircle,
  },
} as const;

function formatMoney(n?: number) {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function CheckIcon({ status }: { status: "PASS" | "WARN" | "FAIL" }) {
  if (status === "PASS") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />;
  if (status === "WARN") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />;
  return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />;
}

function DetailsSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-fk-border/60">
      <button
        type="button"
        className="flex w-full items-center justify-between py-2.5 text-left text-sm text-fk-muted hover:text-fk-foreground"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="pb-3 text-sm">{children}</div>}
    </div>
  );
}

export function CfoCompactAnswerCard({
  question,
  response,
  compact: compactProp,
  snapshotStale,
  onRecalculate,
  onFollowUp,
}: {
  question: string;
  response: CFOAssistantResponse;
  compact: CFOCompactAnswer;
  snapshotStale?: boolean;
  onRecalculate?: () => void;
  onFollowUp?: (q: string) => void;
}) {
  const compact = compactProp ?? response.compact;
  const [showDetails, setShowDetails] = useState(false);
  const style = compact ? STATUS_STYLES[compact.status] : STATUS_STYLES.UNKNOWN;
  const StatusIcon = style.icon;

  useEffect(() => {
    try {
      const pref = localStorage.getItem(DETAILS_PREF_KEY);
      if (pref === "true") setShowDetails(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!compact) return null;

  const toggleDetails = () => {
    setShowDetails((v) => {
      const next = !v;
      try {
        localStorage.setItem(DETAILS_PREF_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <article
      className="w-full max-w-md"
      aria-label={`CFO answer: ${compact.headline}`}
    >
      {snapshotStale && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Your numbers changed since this answer.{" "}
          {onRecalculate && (
            <button type="button" onClick={onRecalculate} className="underline">
              Recalculate
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-2xl ring-1",
          style.ring,
          "bg-fk-navy/90 shadow-lg"
        )}
      >
        {/* Question */}
        <div className="border-b border-fk-border/40 px-4 py-3">
          <p className="text-xs text-fk-muted">Your question</p>
          <p className="mt-0.5 text-sm font-medium leading-snug">{compact.question}</p>
        </div>

        {/* Verdict */}
        <div className={cn("px-4 py-5", style.bg)}>
          <div className="flex items-start gap-3">
            <StatusIcon className={cn("mt-1 h-6 w-6 shrink-0", style.text)} aria-hidden />
            <div>
              <p
                className={cn("text-xl font-bold tracking-tight sm:text-2xl", style.text)}
                role="status"
                aria-live="polite"
              >
                {compact.headline}
              </p>
              <p className="mt-2 text-base font-medium text-fk-foreground">{compact.advice}</p>
              <p className="mt-2 text-sm leading-relaxed text-fk-muted">{compact.reason}</p>
            </div>
          </div>
        </div>

        {/* Three metrics */}
        <div className="grid grid-cols-3 divide-x divide-fk-border/40 border-b border-fk-border/40">
          {compact.primaryMetrics.map((m) => (
            <div key={m.label} className="px-3 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-fk-muted">{m.label}</p>
              <p className="mt-1 text-sm font-semibold text-fk-gold">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Protection checks */}
        <ul className="space-y-1.5 px-4 py-3" aria-label="Protection checks">
          {compact.protectionChecks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-xs">
              <CheckIcon status={c.status} />
              <span
                className={cn(
                  c.status === "PASS" && "text-fk-foreground/90",
                  c.status === "WARN" && "text-amber-200",
                  c.status === "FAIL" && "text-red-300"
                )}
              >
                {c.label}
                {c.status === "PASS" ? "" : c.status === "WARN" ? " — review" : " — at risk"}
              </span>
            </li>
          ))}
        </ul>

        {/* Show details */}
        <div className="border-t border-fk-border/40 px-4 py-2">
          <button
            type="button"
            onClick={toggleDetails}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-fk-gold hover:text-fk-gold/80"
            aria-expanded={showDetails}
          >
            {showDetails ? "Hide details" : "Show details"}
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showDetails && (
          <div className="border-t border-fk-border/40 bg-fk-charcoal/30 px-4 pb-3">
            {compact.details.cost != null && (
              <p className="py-2 text-sm">
                <span className="text-fk-muted">Cost: </span>
                {formatMoney(compact.details.cost)}
                {compact.details.recommendedAccount && (
                  <span className="text-fk-muted"> from {compact.details.recommendedAccount}</span>
                )}
              </p>
            )}

            {compact.details.monthEndImpact != null && (
              <DetailsSection title="Month-end impact">
                <p>{formatMoney(compact.details.monthEndImpact)} projected buffer</p>
              </DetailsSection>
            )}

            {compact.details.yearEndImpact != null && (
              <DetailsSection title="Year-end impact">
                <p>{formatMoney(compact.details.yearEndImpact)} projected buffer</p>
              </DetailsSection>
            )}

            {compact.details.upcomingBills && compact.details.upcomingBills.length > 0 && (
              <DetailsSection title="Upcoming bills">
                <ul className="space-y-1">
                  {compact.details.upcomingBills.map((b) => (
                    <li key={b.label} className="flex justify-between gap-2">
                      <span>{b.label}</span>
                      <span>{formatMoney(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              </DetailsSection>
            )}

            {compact.details.supportingCalculations && compact.details.supportingCalculations.length > 0 && (
              <DetailsSection title="How this was calculated">
                <ul className="space-y-1.5">
                  {compact.details.supportingCalculations.map((c, i) => (
                    <li key={i} className="flex justify-between gap-2 text-fk-muted">
                      <span>{c.label}</span>
                      <span className="text-fk-foreground">
                        {c.amount != null ? formatMoney(c.amount) : c.description ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </DetailsSection>
            )}

            {compact.details.assumptions && compact.details.assumptions.length > 0 && (
              <DetailsSection title="Assumptions">
                <ul className="list-disc space-y-1 pl-4 text-fk-muted">
                  {compact.details.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </DetailsSection>
            )}

            {compact.details.snapshotDate && (
              <p className="mt-2 text-[10px] text-fk-muted">
                Snapshot: {compact.details.snapshotDate}
              </p>
            )}

            <p className="mt-2 flex items-center gap-1 text-[10px] text-fk-muted">
              <Crown className="h-3 w-3 text-fk-gold" />
              Educational guidance only — not fiduciary, legal, or tax advice.
            </p>
          </div>
        )}
      </div>

      {/* Follow-up chips */}
      {compact.suggestedQuestions.length > 0 && onFollowUp && (
        <div className="mt-3 flex flex-wrap gap-2">
          {compact.suggestedQuestions.slice(0, 4).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              className="rounded-full border border-fk-border/80 bg-fk-charcoal/40 px-3 py-1 text-xs text-fk-muted transition-colors hover:border-fk-gold/40 hover:text-fk-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
