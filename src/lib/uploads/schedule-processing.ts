import { processDocument } from "@/workers/process-upload";

/** Run OCR/classification on the web service so uploads complete without a worker. */
export function scheduleDocumentProcessing(documentId: string) {
  void processDocument(documentId).catch((error) => {
    console.error(`Document processing failed for ${documentId}:`, error);
  });
}
