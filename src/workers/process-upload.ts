import { prisma } from "@/lib/db";
import { getOcrProvider } from "@/lib/ocr/provider";
import { getStorage } from "@/lib/storage/provider";
import { buildExtractedFinancialData } from "@/lib/uploads/extract-fields";
import { matchExistingAccount } from "@/lib/uploads/match-account";

export async function processDocument(documentId: string) {
  const doc = await prisma.uploadedDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await prisma.uploadedDocument.update({
    where: { id: documentId },
    data: { status: "PROCESSING" },
  });

  try {
    const storage = getStorage();
    const buffer = await storage.download(doc.storageKey);
    const ocr = getOcrProvider();
    const ocrResult = await ocr.extract(buffer, doc.mimeType);

    const rawText =
      ocrResult.rawText ||
      (doc.mimeType === "text/csv" ? buffer.toString("utf-8") : "");

    const extracted = buildExtractedFinancialData(rawText);
    if (ocrResult.institution && !extracted.institution) {
      extracted.institution = ocrResult.institution;
    }
    if (ocrResult.accountLastFour?.value && !extracted.accountLastFour) {
      extracted.accountLastFour = ocrResult.accountLastFour.value;
      extracted.fieldConfidence.accountLastFour = ocrResult.accountLastFour.confidence;
    }
    if (ocrResult.balance?.value != null && extracted.currentBalance == null) {
      extracted.currentBalance = Number(ocrResult.balance.value);
      extracted.fieldConfidence.currentBalance = ocrResult.balance.confidence;
    }

    const accounts = await prisma.financialAccount.findMany({
      where: { userId: doc.userId },
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
    const match = matchExistingAccount(extracted, accounts);

    const lowConfidence = Object.values(extracted.fieldConfidence).some((c) => c < 0.7);

    await prisma.extractionResult.upsert({
      where: { documentId },
      create: {
        documentId,
        status: "COMPLETE",
        rawText: extracted.rawText ?? rawText,
        extractedData: extracted as object,
        fieldConfidence: extracted.fieldConfidence,
        institution: extracted.institution,
        documentClassification: extracted.classification as object,
        accountMatchResult: match as object,
      },
      update: {
        status: "COMPLETE",
        rawText: extracted.rawText ?? rawText,
        extractedData: extracted as object,
        fieldConfidence: extracted.fieldConfidence,
        institution: extracted.institution,
        documentClassification: extracted.classification as object,
        accountMatchResult: match as object,
      },
    });

    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: {
        status: "REVIEW_REQUIRED",
        documentType: extracted.documentType,
        institution: extracted.institution,
        matchedAccountId: match.accountId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: doc.userId,
        action: "DOCUMENT_PROCESSED",
        entityType: "UploadedDocument",
        entityId: documentId,
        metadata: {
          institution: extracted.institution,
          documentType: extracted.documentType,
          matchScore: match.score,
          lowConfidence,
        },
      },
    });
  } catch (error) {
    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: { status: "REVIEW_REQUIRED" },
    });
    throw error;
  }
}
