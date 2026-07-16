import type { ImportSummary } from "./types";

export function buildImportSummaryMessage(summary: ImportSummary): string {
  if (summary.action === "REJECTED") {
    return "Upload marked as unsupported. No account changes were made.";
  }

  const balancePart =
    summary.previousBalance != null && summary.newBalance != null
      ? `${summary.accountNickname} was updated from $${summary.previousBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} to $${summary.newBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
      : `${summary.accountNickname} was ${summary.action === "CREATED" ? "created" : "updated"}.`;

  const stsDelta = summary.safeToSpendAfter - summary.safeToSpendBefore;
  const stsPart =
    Math.abs(stsDelta) >= 0.01
      ? ` Your safe-to-spend amount ${stsDelta >= 0 ? "increased" : "decreased"} by $${Math.abs(stsDelta).toLocaleString("en-US", { minimumFractionDigits: 2 })} after upcoming bills and protected reserves were recalculated.`
      : "";

  return `${balancePart} ${summary.transactionsImported} transaction${summary.transactionsImported === 1 ? "" : "s"} imported, ${summary.duplicatesSkipped} duplicate${summary.duplicatesSkipped === 1 ? "" : "s"} skipped.${stsPart}`.trim();
}
