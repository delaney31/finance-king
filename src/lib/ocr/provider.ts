import type { OcrExtractionResult, OcrProvider } from "./types";
import { withTimeout } from "@/lib/utils/timeout";

const OCR_TIMEOUT_MS = 20_000;

const INSTITUTION_PATTERNS: [RegExp, string][] = [
  [/penfed|pentagon federal/i, "PenFed"],
  [/wells fargo/i, "Wells Fargo"],
  [/truist/i, "Truist"],
  [/mercury/i, "Mercury"],
  [/american express|amex/i, "American Express"],
  [/current/i, "Current"],
];

function detectInstitution(text: string): string | undefined {
  for (const [pattern, name] of INSTITUTION_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return undefined;
}

function extractBalance(text: string): { value: string; confidence: number } | undefined {
  const patterns = [
    /(?:available balance|current balance|balance)[:\s]*\$?([\d,]+\.\d{2})/i,
    /\$([\d,]+\.\d{2})\s*(?:available|balance)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return { value: m[1].replace(/,/g, ""), confidence: 0.75 };
  }
  return undefined;
}

function extractAccountLastFour(text: string): { value: string; confidence: number } | undefined {
  const m = text.match(/(?:account|ending|•{4})\s*(\d{4})/i);
  if (m) return { value: m[1], confidence: 0.8 };
  return undefined;
}

function redactSensitive(text: string): string {
  return text
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "••••••••••••••••")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "•••-••-••••");
}

export function createTesseractOcrProvider(): OcrProvider {
  return {
    async extract(buffer, mimeType) {
      let rawText = "";

      if (mimeType === "text/csv" || mimeType === "text/plain") {
        rawText = buffer.toString("utf-8");
      } else if (mimeType.startsWith("image/")) {
        try {
          const Tesseract = await import("tesseract.js");
          const result = await withTimeout(
            Tesseract.recognize(buffer, "eng", { logger: () => undefined }),
            OCR_TIMEOUT_MS,
            "OCR"
          );
          rawText = result.data.text;
        } catch (error) {
          console.warn("OCR failed or timed out:", error);
          rawText = "";
        }
      } else {
        rawText = "PDF OCR requires manual review in MVP. Please verify extracted fields.";
      }

      const institution = detectInstitution(rawText);
      const balance = extractBalance(rawText);
      const accountLastFour = extractAccountLastFour(rawText);

      const amountMatches = [...rawText.matchAll(/([+-]?\$?[\d,]+\.\d{2})/g)];
      const transactions = amountMatches.slice(0, 10).map((m) => ({
        amount: { value: m[1].replace(/[$,]/g, ""), confidence: 0.6 },
        description: { value: "Extracted transaction", confidence: 0.5 },
      }));

      return {
        institution,
        accountLastFour,
        balance,
        transactions,
        rawText: redactSensitive(rawText),
      };
    },
  };
}

export function getOcrProvider(): OcrProvider {
  return createTesseractOcrProvider();
}
