"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  fileName: string;
  uploadStatus: string;
  accounts: AccountOption[];
  onClose: () => void;
  onConfirmed: (summary: ImportSummary) => void;
}

type Step = "analyzing" | "review" | "recalculating" | "summary";

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    redirect: "manual",
    ...init,
  });
  if (res.type === "opaqueredirect" || res.status === 307 || res.status === 302) {
    throw new Error("Session expired — refresh the page and sign in again.");
  }
  return res;
}

function emptyReview(documentId: string, fileName: string): ImportReviewPayload {
  return {
    documentId,
    fileName,
    extracted: {
      documentType: "UNKNOWN",
      classification: {
        type: "UNKNOWN",
        confidence: 0,
        reasons: ["Enter account details manually"],
        scores: {
          DEPOSIT_ACCOUNT: 0,
          CREDIT_CARD: 0,
          LOAN: 0,
          TRANSACTION_STATEMENT: 0,
          UNKNOWN: 0,
        },
      },
      transactions: [],
      fieldConfidence: {},
    },
    match: {
      accountId: null,
      score: 0,
      reasons: ["no automatic match"],
      requiresUserConfirmation: true,
      candidates: [],
    },
    duplicateTransactions: [],
    suggestedAction: "CREATE_NEW",
  };
}

export function UploadReviewPanel({
  documentId,
  fileName,
  uploadStatus,
  accounts,
  onClose,
  onConfirmed,
}: UploadReviewPanelProps) {
  const readyForReview = uploadStatus === "REVIEW_REQUIRED" || uploadStatus === "CONFIRMED";
  const [step, setStep] = useState<Step>(readyForReview ? "review" : "analyzing");
  const [review, setReview] = useState<ImportReviewPayload | null>(
    readyForReview ? emptyReview(documentId, fileName) : null
  );
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"UPDATE_EXISTING" | "CREATE_NEW" | "UNSUPPORTED">("CREATE_NEW");
  const [accountId, setAccountId] = useState("");
  const [nickname, setNickname] = useState("New Account");
  const [institution, setInstitution] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [availableBalance, setAvailableBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    readyForReview ? "Loading extracted data…" : "Waiting for analysis to finish…"
  );
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const stallCount = useRef(0);

  function applyReview(data: ImportReviewPayload) {
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
        data.extracted.currentBalance == null &&
        (data.extracted.classification?.confidence ?? 0) < 0.5
    );
    setError("");
    setStep("review");
  }

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    stallCount.current = 0;

    async function loadReview() {
      try {
        let status = uploadStatus;
        const statusRes = await apiFetch(`/api/v1/uploads/${documentId}`);
        if (cancelled) return;

        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as { status: string };
          status = statusData.status;
        }

        const stillProcessing = status === "PENDING" || status === "PROCESSING";
        if (stillProcessing && !readyForReview) {
          stallCount.current += 1;
          setStatusMessage("Still analyzing your upload…");
          if (stallCount.current >= 4) {
            setStatusMessage("Analysis is taking longer than expected — retrying on the server…");
            await apiFetch(`/api/v1/uploads/${documentId}/process`, { method: "POST" });
            stallCount.current = 0;
          }
          return;
        }

        const res = await apiFetch(`/api/v1/uploads/${documentId}/review`);
        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message =
            (body as { error?: string }).error ??
            `Could not load review data (${res.status}). Enter details manually below.`;
          setError(message);
          setExtractionFailed(true);
          setReview((prev) => prev ?? emptyReview(documentId, fileName));
          setStep("review");
          if (interval) clearInterval(interval);
          return;
        }

        const data = (await res.json()) as ImportReviewPayload;
        applyReview(data);
        if (interval) clearInterval(interval);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load review");
          setExtractionFailed(true);
          setReview((prev) => prev ?? emptyReview(documentId, fileName));
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
  }, [documentId, fileName, pollKey, readyForReview, uploadStatus]);

  async function retryAnalysis() {
    setRetrying(true);
    setError("");
    setStep("analyzing");
    setStatusMessage("Re-running OCR and account matching…");
    stallCount.current = 0;
    try {
      const res = await apiFetch(`/api/v1/uploads/${documentId}/process`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Retry failed");
        setReview(emptyReview(documentId, fileName));
        setStep("review");
      } else {
        setPollKey((k) => k + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
      setReview(emptyReview(documentId, fileName));
      setStep("review");
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

    try {
      const res = await apiFetch(`/api/v1/uploads/${documentId}/confirm`, {
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
        setError((data as { error?: string }).error ?? "Import failed");
        setStep("review");
        return;
      }

      setSummary(data as ImportSummary);
      setStep("summary");
      onConfirmed(data as ImportSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("review");
    }
  }

  if (step === "analyzing") {
    return (
      <Card>
        <CardHeader><CardTitle>Analyzing upload…</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-fk-muted">
          <p>{statusMessage}</p>
          <p>Detecting document type, matching accounts, and extracting balances.</p>
          {error && <p className="text-fk-risk-red">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={retryAnalysis} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry analysis"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReview(emptyReview(documentId, fileName));
                setExtractionFailed(true);
                setStep("review");
              }}
            >
              Enter details manually
            </Button>
          </div>
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
                await apiFetch(`/api/v1/uploads/${documentId}/undo`, { method: "POST" });
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
          <p className="text-fk-muted">Loading review data…</p>
          {error && <p className="text-fk-risk-red">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  const reasons = review.extracted.classification?.reasons ?? [];

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
          <Badge variant="warning">
            {Math.round((review.extracted.classification?.confidence ?? 0) * 100)}% type confidence
          </Badge>
          {review.match.accountId && <Badge variant="success">Matched existing account</Badge>}
        </div>

        {reasons.length > 0 && (
          <p className="text-sm text-fk-muted">{reasons.join(" · ")}</p>
        )}

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
            <Label>Choose a different account</Label>
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

        {(review.extracted.transactions?.length ?? 0) > 0 && (
          <Alert>
            <AlertTitle>Review transactions ({review.extracted.transactions.length})</AlertTitle>
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
