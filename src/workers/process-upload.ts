import { prisma } from "@/lib/db";
import { getOcrProvider } from "@/lib/ocr/provider";
import { getStorage } from "@/lib/storage/provider";

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
    const result = await ocr.extract(buffer, doc.mimeType);

    const fieldConfidence: Record<string, number> = {};
    if (result.balance) fieldConfidence.balance = result.balance.confidence;
    if (result.accountLastFour) fieldConfidence.accountLastFour = result.accountLastFour.confidence;

    await prisma.extractionResult.upsert({
      where: { documentId },
      create: {
        documentId,
        status: "COMPLETE",
        rawText: result.rawText,
        extractedData: result as object,
        fieldConfidence,
        institution: result.institution,
      },
      update: {
        status: "COMPLETE",
        rawText: result.rawText,
        extractedData: result as object,
        fieldConfidence,
        institution: result.institution,
      },
    });

    const hasLowConfidence = Object.values(fieldConfidence).some((c) => c < 0.7);
    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: { status: hasLowConfidence ? "REVIEW_REQUIRED" : "REVIEW_REQUIRED", institution: result.institution },
    });

    await prisma.auditLog.create({
      data: {
        userId: doc.userId,
        action: "DOCUMENT_PROCESSED",
        entityType: "UploadedDocument",
        entityId: documentId,
        metadata: { institution: result.institution },
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
