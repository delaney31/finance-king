import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { accountTypeForDocument } from "./classify-document";
import { matchExistingAccount, transactionFingerprint, type MatchableAccount } from "./match-account";
import {
  createEmptyExtracted,
  normalizeExtractedData,
  normalizeMatchResult,
} from "./normalize-extracted";
import {
  buildImportSummaryMessage,
  recalculateFinancialState,
} from "./recalculate-financial-state";
import type {
  ConfirmImportInput,
  ExtractedFinancialData,
  ImportReviewPayload,
  ImportSummary,
} from "./types";

const DEPOSIT_TYPES = new Set([
  "CHECKING",
  "SAVINGS",
  "MONEY_MARKET",
  "BUSINESS_CHECKING",
  "BUSINESS_SAVINGS",
  "JOINT_CHECKING",
  "JOINT_SAVINGS",
]);
const LOAN_TYPES = new Set(["VEHICLE_LOAN", "MORTGAGE", "PERSONAL_LOAN"]);

function mergeExtracted(
  extracted: ExtractedFinancialData,
  confirmed: Partial<ExtractedFinancialData>
): ExtractedFinancialData {
  return { ...extracted, ...confirmed, transactions: confirmed.transactions ?? extracted.transactions };
}

function suggestedActionFromMatch(
  match: ImportReviewPayload["match"],
  documentType: ExtractedFinancialData["documentType"]
): ImportReviewPayload["suggestedAction"] {
  if (documentType === "UNKNOWN") return "UNSUPPORTED";
  if (match.accountId && !match.requiresUserConfirmation) return "UPDATE_EXISTING";
  if (match.candidates.length > 0) return "UPDATE_EXISTING";
  return "CREATE_NEW";
}

export async function buildImportReview(documentId: string, userId: string): Promise<ImportReviewPayload | null> {
  const doc = await prisma.uploadedDocument.findFirst({
    where: { id: documentId, userId },
    include: { extractionResult: true },
  });
  if (!doc) return null;

  const accounts: MatchableAccount[] = await prisma.financialAccount.findMany({
    where: { userId },
    select: {
      id: true,
      nickname: true,
      institution: true,
      accountType: true,
      accountLastFour: true,
      designation: true,
      routingTag: true,
      businessEntityId: true,
    },
  });

  let extracted: ExtractedFinancialData;
  if (doc.extractionResult) {
    extracted = normalizeExtractedData(
      doc.extractionResult.extractedData,
      doc.extractionResult.rawText
    );
  } else {
    extracted = createEmptyExtracted();
    await prisma.extractionResult.upsert({
      where: { documentId },
      create: {
        documentId,
        status: "FAILED",
        rawText: "",
        extractedData: extracted as object,
        fieldConfidence: {},
        documentClassification: extracted.classification as object,
        accountMatchResult: matchExistingAccount(extracted, accounts) as object,
      },
      update: {
        status: "FAILED",
        extractedData: extracted as object,
        fieldConfidence: {},
      },
    });
  }

  const match = normalizeMatchResult(
    doc.extractionResult?.accountMatchResult,
    extracted,
    accounts
  );

  const duplicateTransactions: ImportReviewPayload["duplicateTransactions"] = [];
  const accountIdForDupes = match.accountId ?? match.candidates[0]?.accountId;
  const transactions = extracted.transactions ?? [];

  if (accountIdForDupes && transactions.length > 0) {
    try {
      for (let index = 0; index < transactions.length; index++) {
        const tx = transactions[index];
        const fp = transactionFingerprint({
          accountId: accountIdForDupes,
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
        });
        const existing = await prisma.transactionFingerprint.findUnique({
          where: { userId_fingerprint: { userId, fingerprint: fp } },
        });
        if (existing) {
          duplicateTransactions.push({
            index,
            reason: "matching transaction fingerprint",
            existingId: existing.transactionId ?? undefined,
          });
        }
      }
    } catch (error) {
      console.warn("Duplicate fingerprint check skipped:", error);
    }
  }

  return {
    documentId,
    fileName: doc.fileName,
    extracted,
    match,
    duplicateTransactions,
    suggestedAction: suggestedActionFromMatch(match, extracted.documentType),
  };
}

export async function confirmImport(userId: string, input: ConfirmImportInput): Promise<ImportSummary> {
  const beforeState = await recalculateFinancialState(userId);
  const review = await buildImportReview(input.documentId, userId);
  if (!review) throw new Error("Upload review not found");

  if (input.action === "UNSUPPORTED") {
    await prisma.uploadedDocument.update({
      where: { id: input.documentId },
      data: { status: "REJECTED" },
    });
    const summary: ImportSummary = {
      documentId: input.documentId,
      accountId: "",
      accountNickname: "",
      action: "REJECTED",
      previousBalance: null,
      newBalance: null,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      recurringDetected: 0,
      safeToSpendBefore: beforeState.dashboard.safeToSpend.today,
      safeToSpendAfter: beforeState.dashboard.safeToSpend.today,
      monthEndBufferBefore: beforeState.dashboard.monthEndBuffer,
      monthEndBufferAfter: beforeState.dashboard.monthEndBuffer,
      creditUtilizationBefore: beforeState.dashboard.creditUtilization,
      creditUtilizationAfter: beforeState.dashboard.creditUtilization,
      warnings: [],
      message: "",
    };
    summary.message = buildImportSummaryMessage(summary);
    return summary;
  }

  const extracted = mergeExtracted(review.extracted, input.confirmedFields);
  const skipSet = new Set(input.skipDuplicateIndexes);

  const txResult = await prisma.$transaction(async (tx) => {
    let accountId = input.accountId ?? review.match.accountId ?? undefined;
    let action: ImportSummary["action"] = "UPDATED";
    let previousBalance: number | null = null;
    let accountNickname = "";

    if (input.action === "CREATE_NEW") {
      if (!input.createAccount?.nickname) throw new Error("Nickname required for new account");
      action = "CREATED";
      const accountType =
        input.createAccount.accountType ||
        accountTypeForDocument(extracted.documentType) ||
        "CHECKING";

      const account = await tx.financialAccount.create({
        data: {
          userId,
          institution: input.createAccount.institution || extracted.institution || "Unknown",
          nickname: input.createAccount.nickname,
          accountType: accountType as never,
          ownershipType: (input.createAccount.ownershipType as never) ?? "INDIVIDUAL",
          designation: (input.createAccount.designation as never) ?? "PERSONAL",
          routingTag: (input.createAccount.routingTag as never) ?? "PERSONAL",
          accountLastFour: extracted.accountLastFour,
          currentBalance: extracted.currentBalance ?? 0,
          availableBalance: extracted.availableBalance,
          pendingBalance: extracted.pendingBalance,
          minimumTargetBalance: input.createAccount.minimumTargetBalance ?? 0,
          protectedBalance: input.createAccount.protectedBalance ?? 0,
          creditLimit: extracted.creditLimit ?? input.createAccount.creditLimit,
          minimumPayment: extracted.minimumPayment,
          paymentDueDay: extracted.paymentDueDate ? new Date(extracted.paymentDueDate).getDate() : undefined,
          interestRate: extracted.apr,
          isLiquid: DEPOSIT_TYPES.has(accountType) || accountType === "CREDIT_CARD",
          businessEntityId: input.createAccount.businessEntityId,
        },
      });
      accountId = account.id;
      accountNickname = account.nickname;
      previousBalance = null;

      if (accountType === "CREDIT_CARD") {
        await tx.creditCard.create({
          data: {
            userId,
            accountId: account.id,
            issuer: account.institution,
            currentBalance: extracted.currentBalance ?? 0,
            creditLimit: extracted.creditLimit ?? input.createAccount.creditLimit ?? 0,
            apr: extracted.apr,
            minimumPayment: extracted.minimumPayment,
          },
        });
      } else if (LOAN_TYPES.has(accountType) || extracted.documentType === "LOAN") {
        await tx.debt.create({
          data: {
            userId,
            accountId: account.id,
            name: account.nickname,
            currentBalance: Math.abs(extracted.currentBalance ?? extracted.payoffAmount ?? 0),
            interestRate: extracted.apr,
            minimumPayment: extracted.minimumPayment,
          },
        });
      }
    }

    if (!accountId) throw new Error("Account is required to confirm import");

    const existingAccount = await tx.financialAccount.findFirst({ where: { id: accountId, userId } });
    if (!existingAccount) throw new Error("Account not found");

    if (action === "UPDATED") {
      previousBalance = Number(existingAccount.currentBalance);
      accountNickname = existingAccount.nickname;
    }

    const newBalance = extracted.currentBalance ?? previousBalance ?? 0;

    await tx.financialAccount.update({
      where: { id: accountId },
      data: {
        institution: extracted.institution ?? existingAccount.institution,
        accountLastFour: extracted.accountLastFour ?? existingAccount.accountLastFour,
        currentBalance: newBalance,
        availableBalance: extracted.availableBalance ?? existingAccount.availableBalance,
        pendingBalance: extracted.pendingBalance ?? existingAccount.pendingBalance,
        creditLimit: extracted.creditLimit ?? existingAccount.creditLimit,
        minimumPayment: extracted.minimumPayment ?? existingAccount.minimumPayment,
        interestRate: extracted.apr ?? existingAccount.interestRate,
      },
    });

    if (existingAccount.accountType === "CREDIT_CARD" || extracted.documentType === "CREDIT_CARD") {
      await tx.creditCard.updateMany({
        where: { accountId },
        data: {
          currentBalance: newBalance,
          creditLimit: extracted.creditLimit ?? undefined,
          minimumPayment: extracted.minimumPayment ?? undefined,
          apr: extracted.apr ?? undefined,
        },
      });
    }

    if (LOAN_TYPES.has(existingAccount.accountType) || extracted.documentType === "LOAN") {
      await tx.debt.updateMany({
        where: { accountId },
        data: {
          currentBalance: Math.abs(newBalance),
          interestRate: extracted.apr ?? undefined,
          minimumPayment: extracted.minimumPayment ?? undefined,
        },
      });
    }

    await tx.accountBalanceSnapshot.create({
      data: {
        accountId,
        balance: newBalance,
        asOfDate: new Date(),
        source: "OCR",
        notes: `Confirmed import from upload ${input.documentId}`,
      },
    });

    let transactionsImported = 0;
    let duplicatesSkipped = 0;
    const importedTransactionIds: string[] = [];

    for (const index of input.confirmedTransactionIndexes) {
      if (skipSet.has(index)) {
        duplicatesSkipped++;
        continue;
      }
      const item = extracted.transactions[index];
      if (!item) continue;

      const fp = transactionFingerprint({
        accountId,
        date: item.date,
        amount: item.amount,
        description: item.description,
      });

      const duplicate = await tx.transactionFingerprint.findUnique({
        where: { userId_fingerprint: { userId, fingerprint: fp } },
      });
      if (duplicate) {
        duplicatesSkipped++;
        continue;
      }

      const isTransfer = /\btransfer\b/i.test(item.description);

      const created = await tx.transaction.create({
        data: {
          userId,
          accountId,
          amount: Math.abs(item.amount),
          date: item.date ? new Date(item.date) : new Date(),
          description: item.description,
          type: isTransfer ? "TRANSFER" : item.amount >= 0 ? "INCOME" : "EXPENSE",
          isTransfer,
          isPending: item.status === "PENDING",
          clearanceStatus: item.status,
          transactionFingerprint: fp,
          confidence: item.confidence,
          documentId: input.documentId,
        },
      });
      importedTransactionIds.push(created.id);

      await tx.transactionFingerprint.create({
        data: {
          userId,
          accountId,
          fingerprint: fp,
          transactionId: created.id,
          documentId: input.documentId,
        },
      });
      transactionsImported++;
    }

    await tx.uploadedDocument.update({
      where: { id: input.documentId },
      data: {
        status: "CONFIRMED",
        matchedAccountId: accountId,
        documentType: extracted.documentType,
        institution: extracted.institution,
        undoPayload: {
          accountId,
          previousBalance,
          previousAvailableBalance: existingAccount.availableBalance
            ? Number(existingAccount.availableBalance)
            : null,
          previousPendingBalance: existingAccount.pendingBalance
            ? Number(existingAccount.pendingBalance)
            : null,
          importedTransactionIds,
        },
      },
    });

    await tx.extractionResult.update({
      where: { documentId: input.documentId },
      data: { reviewedAt: new Date(), reviewedBy: userId },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "IMPORT_CONFIRMED",
        entityType: "UploadedDocument",
        entityId: input.documentId,
        metadata: { accountId, transactionsImported, duplicatesSkipped, newBalance },
      },
    });

    return {
      accountId,
      accountNickname,
      action,
      previousBalance,
      newBalance,
      transactionsImported,
      duplicatesSkipped,
    };
  });

  const afterState = await recalculateFinancialState(userId);
  const summary: ImportSummary = {
    documentId: input.documentId,
    accountId: txResult.accountId,
    accountNickname: txResult.accountNickname,
    action: txResult.action,
    previousBalance: txResult.previousBalance,
    newBalance: txResult.newBalance,
    transactionsImported: txResult.transactionsImported,
    duplicatesSkipped: txResult.duplicatesSkipped,
    recurringDetected: 0,
    safeToSpendBefore: beforeState.dashboard.safeToSpend.today,
    safeToSpendAfter: afterState.dashboard.safeToSpend.today,
    monthEndBufferBefore: beforeState.dashboard.monthEndBuffer,
    monthEndBufferAfter: afterState.dashboard.monthEndBuffer,
    creditUtilizationBefore: beforeState.dashboard.creditUtilization,
    creditUtilizationAfter: afterState.dashboard.creditUtilization,
    warnings:
      extracted.classification.confidence < 0.7 ? ["Low OCR confidence — manual review required"] : [],
    message: "",
    undoToken: input.documentId,
    recommendedNextAction:
      txResult.action === "CREATED"
        ? "Set routing rules and protected balance for the new account."
        : undefined,
  };
  summary.message = buildImportSummaryMessage(summary);

  await prisma.uploadedDocument.update({
    where: { id: input.documentId },
    data: { importSummary: summary as unknown as Prisma.InputJsonValue },
  });

  return summary;
}

export async function undoImport(userId: string, documentId: string) {
  const doc = await prisma.uploadedDocument.findFirst({
    where: { id: documentId, userId, status: "CONFIRMED" },
  });
  if (!doc?.undoPayload) throw new Error("Nothing to undo for this upload");

  const undo = doc.undoPayload as {
    accountId: string;
    previousBalance: number | null;
    previousAvailableBalance: number | null;
    previousPendingBalance: number | null;
    importedTransactionIds: string[];
  };

  await prisma.$transaction(async (tx) => {
    if (undo.importedTransactionIds.length > 0) {
      await tx.transaction.deleteMany({
        where: { id: { in: undo.importedTransactionIds }, userId },
      });
    }
    await tx.transactionFingerprint.deleteMany({ where: { documentId, userId } });
    if (undo.previousBalance != null) {
      await tx.financialAccount.update({
        where: { id: undo.accountId },
        data: {
          currentBalance: undo.previousBalance,
          availableBalance: undo.previousAvailableBalance,
          pendingBalance: undo.previousPendingBalance,
        },
      });
    }
    await tx.uploadedDocument.update({
      where: { id: documentId },
      data: { status: "REVIEW_REQUIRED", undoPayload: Prisma.JsonNull },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "IMPORT_UNDONE",
        entityType: "UploadedDocument",
        entityId: documentId,
      },
    });
  });

  await recalculateFinancialState(userId);
  return {
    success: true,
    message: "Import reversed and dashboard recalculated.",
    restoredBalance: undo.previousBalance ?? undefined,
  };
}
