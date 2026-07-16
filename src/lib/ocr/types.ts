export interface OcrField {
  value: string;
  confidence: number;
}

export interface OcrExtractionResult {
  institution?: string;
  accountLastFour?: OcrField;
  balance?: OcrField;
  transactions: {
    date?: OcrField;
    description?: OcrField;
    amount?: OcrField;
  }[];
  rawText: string;
}

export interface OcrProvider {
  extract(buffer: Buffer, mimeType: string): Promise<OcrExtractionResult>;
}
