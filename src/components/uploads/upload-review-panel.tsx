"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatMoney } from "@/lib/utils/money";
import type { ImportReviewPayload, ImportSummary, UploadedFinancialDocumentType } from "@/lib/uploads/types";
import {
  DOCUMENT_TYPE_OPTIONS,
  accountTypeForDocument,
  createNewLabel,
  documentTypeLabel,
  filterCompatibleAccounts,
  normalizeDocumentType,
  requiresManualTypeSelection,
  updateExistingLabel,
  validateReviewForm,
} from "@/lib/uploads/document-types";
import { ReviewFormFields, type ReviewFieldValues } from "@/components/uploads/review-form-fields";

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
type ImportAction = "UPDATE_EXISTING" | "CREATE_NEW" | "UNSUPPORTED";

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: "include", redirect: "manual", ...init });
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
        reasons: ["Select a financial document type"],
        scores: {
          CHECKING: 0,
          SAVINGS: 0,
          MONEY_MARKET: 0,
          CREDIT_CARD: 0,
          LOAN: 0,
          TRANSACTION_STATEMENT: 0,
          UNKNOWN: 0,
        },
      },
      transactions: [],
      fieldConfidence: {},
    },
    match: { accountId: null, score: 0, reasons: [], requiresUserConfirmation: true, candidates: [] },
    duplicateTransactions: [],
    suggestedAction: "CREATE_NEW",
  };
}

function initialFields(extracted: ImportReviewPayload["extracted"]): ReviewFieldValues {
  return {
    nickname: extracted.institution ? `${extracted.institution} Account` : "New Account",
    institution: extracted.institution ?? "",
    accountLastFour: extracted.accountLastFour ?? "",
    currentBalance: extracted.currentBalance?.toString() ?? "",
    availableBalance: extracted.availableBalance?.toString() ?? "",
    pendingBalance: extracted.pendingBalance?.toString() ?? "",
    statementBalance: extracted.statementBalance?.toString() ?? "",
    creditLimit: extracted.creditLimit?.toString() ?? "",
    availableCredit: extracted.availableCredit?.toString() ?? "",
    minimumPayment: extracted.minimumPayment?.toString() ?? "",
    paymentDueDate: extracted.paymentDueDate ?? "",
    statementCloseDate: extracted.statementCloseDate ?? "",
    statementDate: extracted.statementDate ?? "",
    apr: extracted.apr?.toString() ?? "",
    payoffAmount: extracted.payoffAmount?.toString() ?? "",
    interestRate: extracted.apr?.toString() ?? "",
    monthlyPayment: extracted.minimumPayment?.toString() ?? "",
    maturityDate: "",
    ownershipType: "INDIVIDUAL",
    designation: "PERSONAL",
    protectedBalance: "",
    minimumTargetBalance: "",
    autopayEnabled: false,
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
  const [action, setAction] = useState<ImportAction | "">("");
  const [selectedType, setSelectedType] = useState<UploadedFinancialDocumentType | "">("");
  const [typeManuallyConfirmed, setTypeManuallyConfirmed] = useState(false);
  const [fields, setFields] = useState<ReviewFieldValues>(initialFields(emptyReview(documentId, fileName).extracted));
  const [accountId, setAccountId] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    readyForReview ? "Loading extracted data…" : "Waiting for analysis to finish…"
  );
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const stallCount = useRef(0);

  const detectedType = review
    ? normalizeDocumentType(review.extracted.documentType, review.extracted.rawText)
    : "UNKNOWN";
  const confidence = review?.extracted.classification?.confidence ?? 0;
  const needsManualType = requiresManualTypeSelection(detectedType, confidence);
  const activeType = (selectedType || (needsManualType ? "" : detectedType)) as UploadedFinancialDocumentType | "";

  const compatibleAccounts = useMemo(
    () => (activeType ? filterCompatibleAccounts(activeType, accounts) : []),
    [activeType, accounts]
  );

  const compatibleCandidates = useMemo(() => {
    if (!review || !activeType) return [];
    return review.match.candidates.filter((c) =>
      compatibleAccounts.some((a) => a.id === c.accountId)
    );
  }, [review, activeType, compatibleAccounts]);

  const hasLowConfidenceFields = useMemo(() => {
    if (!review) return false;
    return Object.values(review.extracted.fieldConfidence).some((c) => c < 0.7);
  }, [review]);

  const validation = validateReviewForm({
    documentType: activeType,
    action,
    accountId,
    nickname: fields.nickname,
    institution: fields.institution,
    accountLastFour: fields.accountLastFour,
    currentBalance: fields.currentBalance,
    availableBalance: fields.availableBalance,
    pendingBalance: fields.pendingBalance,
    statementBalance: fields.statementBalance,
    creditLimit: fields.creditLimit,
    availableCredit: fields.availableCredit,
    minimumPayment: fields.minimumPayment,
    paymentDueDate: fields.paymentDueDate,
    statementCloseDate: fields.statementCloseDate,
    statementDate: fields.statementDate,
    apr: fields.apr,
    payoffAmount: fields.payoffAmount,
    interestRate: fields.interestRate,
    monthlyPayment: fields.monthlyPayment,
    maturityDate: fields.maturityDate,
    ownershipType: fields.ownershipType,
    designation: fields.designation,
    protectedBalance: fields.protectedBalance,
    minimumTargetBalance: fields.minimumTargetBalance,
    autopayEnabled: fields.autopayEnabled,
    typeManuallyConfirmed: !needsManualType || typeManuallyConfirmed,
    lowConfidenceAcknowledged: true,
    needsManualType,
  });

  function applyReview(data: ImportReviewPayload) {
    const normalized = normalizeDocumentType(data.extracted.documentType, data.extracted.rawText);
    const manual = requiresManualTypeSelection(normalized, data.extracted.classification?.confidence ?? 0);
    setReview(data);
    setFields(initialFields(data.extracted));
    setSelectedType(manual ? "" : normalized);
    setTypeManuallyConfirmed(!manual);
    setAction(manual ? "" : data.suggestedAction);
    setAccountId(data.match.accountId ?? data.match.candidates[0]?.accountId ?? "");
    setExtractionFailed(manual);
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
          status = ((await statusRes.json()) as { status: string }).status;
        }
        if ((status === "PENDING" || status === "PROCESSING") && !readyForReview) {
          stallCount.current += 1;
          setStatusMessage("Still analyzing your upload…");
          if (stallCount.current >= 4) {
            await apiFetch(`/api/v1/uploads/${documentId}/process`, { method: "POST" });
            stallCount.current = 0;
          }
          return;
        }
        const res = await apiFetch(`/api/v1/uploads/${documentId}/review`);
        if (cancelled) return;
        if (!res.ok) {
          setError("Could not load review data. Select a document type and enter details manually.");
          setExtractionFailed(true);
          setReview((prev) => prev ?? emptyReview(documentId, fileName));
          setStep("review");
          if (interval) clearInterval(interval);
          return;
        }
        applyReview((await res.json()) as ImportReviewPayload);
        if (interval) clearInterval(interval);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load review");
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

  useEffect(() => {
    if (!accountId) return;
    if (!compatibleAccounts.some((a) => a.id === accountId)) setAccountId("");
  }, [activeType, accountId, compatibleAccounts]);

  function onTypeChange(value: string) {
    const next = value as UploadedFinancialDocumentType | "";
    setSelectedType(next);
    setTypeManuallyConfirmed(true);
    setAccountId("");
    if (next === "UNKNOWN") setAction("UNSUPPORTED");
    else if (action === "UNSUPPORTED") setAction("");
  }

  async function retryAnalysis() {
    setRetrying(true);
    setStep("analyzing");
    try {
      await apiFetch(`/api/v1/uploads/${documentId}/process`, { method: "POST" });
      setPollKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
      setStep("review");
    } finally {
      setRetrying(false);
    }
  }

  async function confirmImport() {
    if (!review) return;
    setStep("recalculating");
    setError("");

    if (action === "UNSUPPORTED") {
      try {
        const res = await apiFetch(`/api/v1/uploads/${documentId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType: "UNKNOWN",
            action: "UNSUPPORTED",
            confirmedFields: {},
            confirmedTransactionIndexes: [],
            skipDuplicateIndexes: [],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Import failed");
        setSummary(data as ImportSummary);
        setStep("summary");
        onConfirmed(data as ImportSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
        setStep("review");
      }
      return;
    }

    if (!activeType || activeType === "UNKNOWN") return;
    const num = (v: string) => (v.trim() ? Number(v) : undefined);

    try {
      const res = await apiFetch(`/api/v1/uploads/${documentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: activeType,
          action,
          accountId: action === "UPDATE_EXISTING" ? accountId : undefined,
          createAccount:
            action === "CREATE_NEW"
              ? {
                  nickname: fields.nickname,
                  institution: fields.institution,
                  accountType: accountTypeForDocument(activeType),
                  ownershipType: fields.ownershipType,
                  designation: fields.designation,
                  protectedBalance: num(fields.protectedBalance),
                  minimumTargetBalance: num(fields.minimumTargetBalance),
                  creditLimit: num(fields.creditLimit),
                }
              : undefined,
          confirmedFields: {
            documentType: activeType,
            institution: fields.institution,
            accountLastFour: fields.accountLastFour || undefined,
            currentBalance: num(fields.currentBalance),
            availableBalance: num(fields.availableBalance),
            pendingBalance: num(fields.pendingBalance),
            statementBalance: num(fields.statementBalance),
            creditLimit: num(fields.creditLimit),
            availableCredit: num(fields.availableCredit),
            minimumPayment: num(fields.minimumPayment) ?? num(fields.monthlyPayment),
            paymentDueDate: fields.paymentDueDate || undefined,
            statementCloseDate: fields.statementCloseDate || undefined,
            statementDate: fields.statementDate || undefined,
            apr: num(fields.apr) ?? num(fields.interestRate),
            payoffAmount: num(fields.payoffAmount),
          },
          confirmedTransactionIndexes: review.extracted.transactions.map((_, i) => i),
          skipDuplicateIndexes: review.duplicateTransactions.map((d) => d.index),
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
          <Button variant="outline" size="sm" onClick={retryAnalysis} disabled={retrying}>Retry analysis</Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "recalculating") {
    return (
      <Card>
        <CardHeader><CardTitle>Recalculating dashboard…</CardTitle></CardHeader>
        <CardContent className="text-sm text-fk-muted">Updating balances, forecasts, and credit metrics.</CardContent>
      </Card>
    );
  }

  if (step === "summary" && summary) {
    return (
      <Card className="border-fk-gold/40">
        <CardHeader><CardTitle>Import summary</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Type:</strong> {documentTypeLabel(summary.documentType)}</p>
          <p>{summary.message}</p>
          <p>Safe to spend: {formatMoney(summary.safeToSpendBefore)} → {formatMoney(summary.safeToSpendAfter)}</p>
          {summary.documentType === "CREDIT_CARD" && summary.creditUtilizationBefore != null && (
            <p>
              Utilization: {(summary.creditUtilizationBefore * 100).toFixed(1)}% →{" "}
              {((summary.creditUtilizationAfter ?? 0) * 100).toFixed(1)}%
            </p>
          )}
          <Button onClick={onClose}>Done</Button>
        </CardContent>
      </Card>
    );
  }

  if (!review) return null;

  const canCreate = Boolean(activeType && activeType !== "UNKNOWN");
  const showUpdate = activeType && activeType !== "UNKNOWN" && compatibleAccounts.length > 0;

  return (
    <Card className="border-fk-gold/40">
      <CardHeader><CardTitle>Review extraction — {review.fileName}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {extractionFailed && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTitle>Manual classification required</AlertTitle>
            <AlertDescription>
              OCR confidence is low. Select the financial document type before confirming.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border border-fk-gold/40 bg-fk-gold/5 p-4 space-y-2">
          <Label className="text-base font-semibold">Financial document type *</Label>
          <select
            className="w-full rounded-md border border-fk-border bg-fk-charcoal px-3 py-2 text-sm"
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            <option value="">Select document type…</option>
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {!needsManualType && detectedType !== "UNKNOWN" && !selectedType && (
            <p className="text-xs text-fk-muted">
              OCR detected: {documentTypeLabel(detectedType)} ({Math.round(confidence * 100)}% confidence)
            </p>
          )}
        </div>

        {activeType && activeType !== "UNKNOWN" && (
          <>
            <div className="flex flex-wrap gap-2">
              {showUpdate && (
                <Button
                  variant={action === "UPDATE_EXISTING" ? "default" : "outline"}
                  onClick={() => setAction("UPDATE_EXISTING")}
                >
                  {updateExistingLabel(activeType)}
                </Button>
              )}
              {canCreate && (
                <Button
                  variant={action === "CREATE_NEW" ? "default" : "outline"}
                  onClick={() => setAction("CREATE_NEW")}
                >
                  {createNewLabel(activeType)}
                </Button>
              )}
              <Button
                variant={action === "UNSUPPORTED" ? "destructive" : "outline"}
                onClick={() => setAction("UNSUPPORTED")}
              >
                Mark unsupported
              </Button>
            </div>

            {action === "UPDATE_EXISTING" && (
              <div className="space-y-2">
                <Label>Compatible accounts only</Label>
                <select
                  className="w-full rounded-md border border-fk-border bg-fk-charcoal px-3 py-2 text-sm"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">Select account…</option>
                  {compatibleCandidates.map((c) => (
                    <option key={c.accountId} value={c.accountId}>
                      {c.nickname} ({c.institution}) — score {c.score}
                    </option>
                  ))}
                  {compatibleAccounts
                    .filter((a) => !compatibleCandidates.some((c) => c.accountId === a.id))
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.nickname} ({a.institution})</option>
                    ))}
                </select>
              </div>
            )}

            <ReviewFormFields
              documentType={activeType}
              values={fields}
              onChange={(patch) => setFields((prev) => ({ ...prev, ...patch }))}
              showNickname={action === "CREATE_NEW"}
            />

            {(review.extracted.transactions?.length ?? 0) > 0 && (
              <Alert>
                <AlertTitle>Transactions extracted ({review.extracted.transactions.length})</AlertTitle>
                <AlertDescription>
                  {review.duplicateTransactions.length} suspected duplicate(s) will be skipped.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {activeType === "UNKNOWN" && action === "UNSUPPORTED" && (
          <p className="text-sm text-fk-muted">This upload will be rejected with no account changes.</p>
        )}

        {validation.errors.length > 0 && action !== "UNSUPPORTED" && (
          <ul className="text-sm text-fk-risk-red list-disc pl-5">
            {validation.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        {error && <p className="text-sm text-fk-risk-red">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={confirmImport}
            disabled={action === "UNSUPPORTED" ? false : !validation.valid}
          >
            Confirm and recalculate
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
