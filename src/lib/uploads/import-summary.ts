import type { ImportSummary } from "./types";
import { documentTypeLabel } from "./document-types";

export function buildImportSummaryMessage(summary: ImportSummary): string {
  if (summary.action === "REJECTED") {
    return "Upload marked as unsupported. No account changes were made.";
  }

  const typeLabel = documentTypeLabel(summary.documentType);
  const balancePart =
    summary.previousBalance != null && summary.newBalance != null
      ? `${summary.accountNickname} (${typeLabel}) was updated from $${summary.previousBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} to $${summary.newBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
      : `${summary.accountNickname} (${typeLabel}) was ${summary.action === "CREATED" ? "created" : "updated"}.`;

  const stsDelta = summary.safeToSpendAfter - summary.safeToSpendBefore;
  const stsPart =
    Math.abs(stsDelta) >= 0.01
      ? ` Your safe-to-spend amount ${stsDelta >= 0 ? "increased" : "decreased"} by $${Math.abs(stsDelta).toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
      : "";

  const utilPart =
    summary.documentType === "CREDIT_CARD" &&
    summary.creditUtilizationBefore != null &&
    summary.creditUtilizationAfter != null &&
    Math.abs(summary.creditUtilizationAfter - summary.creditUtilizationBefore) >= 0.001
      ? ` Credit utilization changed from ${(summary.creditUtilizationBefore * 100).toFixed(1)}% to ${(summary.creditUtilizationAfter * 100).toFixed(1)}%.`
      : "";

  return `${balancePart} ${summary.transactionsImported} transaction${summary.transactionsImported === 1 ? "" : "s"} imported, ${summary.duplicatesSkipped} duplicate${summary.duplicatesSkipped === 1 ? "" : "s"} skipped.${stsPart}${utilPart}`.trim();
}
