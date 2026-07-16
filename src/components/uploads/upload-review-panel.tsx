"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatMoney } from "@/lib/utils/money";
import type { ImportReviewPayload, ImportSummary } from "@/lib/uploads/types";
import { inferDepositAccountType } from "@/lib/uploads/classify-document";

interface AccountOption {
  id: string;
  nickname: string;
  institution: string;
  accountType: string;
}

interface UploadReviewPanelProps {
  documentId: string;
  accounts: AccountOption[];
  onClose: () => void;
  onConfirmed: (summary: ImportSummary) => void;
}

type Step = "analyzing" | "review" | "recalculating" | "summary";

export function UploadReviewPanel({ documentId, accounts, onClose, onConfirmed }: UploadReviewPanelProps) {
  const [step, setStep] = useState<Step>("analyzing");
  const [review, setReview] = useState<ImportReviewPayload | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"UPDATE_EXISTING" | "CREATE_NEW" | "UNSUPPORTED">("UPDATE_EXISTING");
  const [accountId, setAccountId] = useState("");
  const [nickname, setNickname] = useState("");
  const [institution, setInstitution] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [availableBalance, setAvailableBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [statusMessage, setStatusMessage] = useState("Loading review data…");
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pollKey, setPollKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function loadReview() {
      try {
        const statusRes = await fetch(`/api/v1/uploads/${documentId}`);
        if (cancelled) return;

        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as { status: string };
          if (statusData.status === "PENDING" || statusData.status === "PROCESSING") {
            setStatusMessage("Still analyzing your upload…");
            return;
          }
        }

        const res = await fetch(`/api/v1/uploads/${documentId}/review`);
        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            (body as { error?: string }).error ??
              `Could not load review data (${res.status}). Try retrying analysis.`
          );
          setExtractionFailed(true);
          setStep("review");
          if (interval) clearInterval(interval);
          return;
        }

        const data = (await res.json()) as ImportReviewPayload;
        setReview(data);
        setAction(data.suggestedAction);
        setAccountId(data.match.accountId ?? data.match.candidates[0]?.accountId ?? "");
        setNickname(data.extracted.institution ? `${data.extracted.institution} Account` : "New Account");
        setInstitution(data.extracted.institution ?? "");
        setCurrentBalance(data.extracted.currentBalance?.toString() ?? "");
        setAvailableBalance(data.extracted.availableBalance?.toString() ?? "");
        setCreditLimit(data.extracted.creditLimit?.toString() ?? "");
        setMinimumPayment(data.extracted.minimumPayment?.toString() ?? "");
        setExtractionFailed(
          data.extracted.documentType === "UNKNOWN" &&
            !data.extracted.currentBalance &&
            data.extracted.classification.confidence === 0
        );
        setError("");
        setStep("review");
        if (interval) clearInterval(interval);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load review");
          setExtractionFailed(true);
          setStep("review");
          if (interval) clearInterval(interval);
        }
      }
    }

    loadReview();
    interval = setInterval(loadReview, 2500);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [documentId, pollKey]);

  async function retryAnalysis() {
    setRetrying(true);
    setError("");
    setReview(null);
    setStep("analyzing");
    setStatusMessage("Re-running OCR and account matching…");
    try {
      const res = await fetch(`/api/v1/uploads/${documentId}/process`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Retry failed");
      }
      setPollKey((k) => k + 1);
    } finally {
      setRetrying(false);
    }
  }

  const createLabel =
    review?.extracted.documentType === "CREDIT_CARD"
      ? "Create new credit card"
      : review?.extracted.documentType === "LOAN"
        ? "Create new loan account"
        : review?.extracted.rawText && /\bsavings\b/i.test(review.extracted.rawText)
          ? "Create new savings account"
          : "Create new checking account";

  const duplicateIndexes = useMemo(
    () => new Set(review?.duplicateTransactions.map((d) => d.index) ?? []),
    [review]
  );

  async function confirmImport() {
    if (!review) return;
    setStep("recalculating");
    setError("");

    const confirmedTransactionIndexes = review.extracted.transactions.map((_, index) => index);
    const skipDuplicateIndexes = [...duplicateIndexes];

    const res = await fetch(`/api/v1/uploads/${documentId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        accountId: action === "UPDATE_EXISTING" ? accountId : undefined,
        createAccount:
          action === "CREATE_NEW"
            ? {
                nickname,
                institution,
                accountType:
                  review.extracted.documentType === "CREDIT_CARD"
                    ? "CREDIT_CARD"
                    : review.extracted.documentType === "LOAN"
                      ? "PERSONAL_LOAN"
                      : review.extracted.rawText
                        ? inferDepositAccountType(review.extracted.rawText)
                        : "CHECKING",
              }
            : undefined,
        confirmedFields: {
          institution,
          currentBalance: currentBalance ? Number(currentBalance) : undefined,
          availableBalance: availableBalance ? Number(availableBalance) : undefined,
          creditLimit: creditLimit ? Number(creditLimit) : undefined,
          minimumPayment: minimumPayment ? Number(minimumPayment) : undefined,
        },
        confirmedTransactionIndexes,
        skipDuplicateIndexes,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      setStep("review");
      return;
    }

    setSummary(data as ImportSummary);
    setStep("summary");
    onConfirmed(data as ImportSummary);
  }

  if (step === "analyzing") {
    return (
      <Card>
        <CardHeader><CardTitle>Analyzing upload…</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-fk-muted">
          <p>{statusMessage}</p>
          <p>Detecting document type, matching accounts, and extracting balances.</p>
          {error && <p className="text-fk-risk-red">{error}</p>}
          <Button variant="outline" size="sm" onClick={retryAnalysis} disabled={retrying}>
            {retrying ? "Retrying…" : "Retry analysis"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "recalculating") {
    return (
      <Card>
        <CardHeader><CardTitle>Recalculating dashboard…</CardTitle></CardHeader>
        <CardContent className="text-sm text-fk-muted">
          Updating balances, transactions, safe-to-spend, and forecasts.
        </CardContent>
      </Card>
    );
  }

  if (step === "summary" && summary) {
    return (
      <Card className="border-fk-gold/40">
        <CardHeader><CardTitle>Import summary</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{summary.message}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <p>Safe to spend: {formatMoney(summary.safeToSpendBefore)} → {formatMoney(summary.safeToSpendAfter)}</p>
            <p>Month-end buffer: {formatMoney(summary.monthEndBufferBefore)} → {formatMoney(summary.monthEndBufferAfter)}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose}>Done</Button>
            <Button
              variant="outline"
              onClick={async () => {
                await fetch(`/api/v1/uploads/${documentId}/undo`, { method: "POST" });
                onClose();
              }}
            >
              Undo import
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!review) {
    return (
      <Card className="border-fk-gold/40">
        <CardHeader><CardTitle>Review extraction</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-fk-muted">
            Automatic extraction could not load. You can retry analysis or enter details manually after retry.
          </p>
          {error && <p className="text-fk-risk-red">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={retryAnalysis} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry analysis"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-fk-gold/40">
      <CardHeader>
        <CardTitle>Review extraction — {review.fileName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {extractionFailed && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTitle>Manual review recommended</AlertTitle>
            <AlertDescription>
              OCR could not read this screenshot reliably. Fill in the fields below, or retry analysis.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{review.extracted.documentType}</Badge>
          <Badge variant="warning">{Math.round(review.extracted.classification.confidence * 100)}% type confidence</Badge>
          {review.match.accountId && <Badge variant="success">Matched existing account</Badge>}
        </div>

        <p className="text-sm text-fk-muted">{review.extracted.classification.reasons.join(" · ")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Institution</Label>
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Current balance</Label>
            <Input value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Available balance</Label>
            <Input value={availableBalance} onChange={(e) => setAvailableBalance(e.target.value)} />
          </div>
          {review.extracted.documentType === "CREDIT_CARD" && (
            <>
              <div className="space-y-2">
                <Label>Credit limit</Label>
                <Input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Minimum payment</Label>
                <Input value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant={action === "UPDATE_EXISTING" ? "default" : "outline"} onClick={() => setAction("UPDATE_EXISTING")}>
            Update existing account
          </Button>
          <Button variant={action === "CREATE_NEW" ? "default" : "outline"} onClick={() => setAction("CREATE_NEW")}>
            {createLabel}
          </Button>
          <Button variant={action === "UNSUPPORTED" ? "destructive" : "outline"} onClick={() => setAction("UNSUPPORTED")}>
            Mark unsupported
          </Button>
        </div>

        {action === "UPDATE_EXISTING" && (
          <div className="space-y-2">
            <Label>Choose account</Label>
            <select
              className="w-full rounded-md border border-fk-border bg-fk-charcoal px-3 py-2 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Select account…</option>
              {review.match.candidates.map((c) => (
                <option key={c.accountId} value={c.accountId}>
                  {c.nickname} ({c.institution}) — score {c.score}
                </option>
              ))}
              {accounts
                .filter((a) => !review.match.candidates.some((c) => c.accountId === a.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname} ({a.institution})
                  </option>
                ))}
            </select>
          </div>
        )}

        {action === "CREATE_NEW" && (
          <div className="space-y-2">
            <Label>Account nickname</Label>
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
        )}

        {review.extracted.transactions.length > 0 && (
          <Alert>
            <AlertTitle>Transactions extracted ({review.extracted.transactions.length})</AlertTitle>
            <AlertDescription>
              {review.duplicateTransactions.length} suspected duplicate
              {review.duplicateTransactions.length === 1 ? "" : "s"} will be skipped unless you override.
            </AlertDescription>
          </Alert>
        )}

        {error && <p className="text-sm text-fk-risk-red">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={confirmImport}>Confirm and recalculate</Button>
          <Button variant="outline" onClick={retryAnalysis} disabled={retrying}>
            {retrying ? "Retrying…" : "Retry analysis"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
