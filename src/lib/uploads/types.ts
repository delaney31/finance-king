export type UploadedFinancialDocumentType =
  | "CHECKING"
  | "SAVINGS"
  | "MONEY_MARKET"
  | "CREDIT_CARD"
  | "LOAN"
  | "TRANSACTION_STATEMENT"
  | "UNKNOWN";

export type TransactionClearanceStatus =
  | "CLEARED"
  | "PENDING"
  | "PROJECTED"
  | "CANCELLED";

export interface DocumentClassification {
  type: UploadedFinancialDocumentType;
  confidence: number;
  reasons: string[];
  scores: Record<UploadedFinancialDocumentType, number>;
}

export interface AccountMatchResult {
  accountId: string | null;
  score: number;
  reasons: string[];
  requiresUserConfirmation: boolean;
  candidates: AccountMatchCandidate[];
}

export interface AccountMatchCandidate {
  accountId: string;
  nickname: string;
  institution: string;
  accountType: string;
  accountLastFour: string | null;
  score: number;
  reasons: string[];
}

export interface ExtractedTransaction {
  date?: string;
  description: string;
  amount: number;
  status: TransactionClearanceStatus;
  confidence: number;
  fingerprint?: string;
}

export interface ExtractedFinancialData {
  institution?: string;
  accountLastFour?: string;
  documentType: UploadedFinancialDocumentType;
  classification: DocumentClassification;
  currentBalance?: number;
  availableBalance?: number;
  pendingBalance?: number;
  statementBalance?: number;
  creditLimit?: number;
  availableCredit?: number;
  minimumPayment?: number;
  paymentDueDate?: string;
  statementDate?: string;
  statementCloseDate?: string;
  apr?: number;
  payoffAmount?: number;
  transactions: ExtractedTransaction[];
  fieldConfidence: Record<string, number>;
  rawText?: string;
}

export interface ImportReviewPayload {
  documentId: string;
  fileName: string;
  extracted: ExtractedFinancialData;
  match: AccountMatchResult;
  duplicateTransactions: { index: number; reason: string; existingId?: string }[];
  suggestedAction: "UPDATE_EXISTING" | "CREATE_NEW" | "UNSUPPORTED";
}

export interface ConfirmImportInput {
  documentId: string;
  documentType: UploadedFinancialDocumentType;
  action: "UPDATE_EXISTING" | "CREATE_NEW" | "UNSUPPORTED";
  accountId?: string;
  createAccount?: {
    nickname: string;
    institution: string;
    accountType: string;
    ownershipType?: string;
    designation?: string;
    routingTag?: string;
    minimumTargetBalance?: number;
    protectedBalance?: number;
    creditLimit?: number;
    businessEntityId?: string;
  };
  confirmedFields: Partial<ExtractedFinancialData>;
  confirmedTransactionIndexes: number[];
  skipDuplicateIndexes: number[];
}

export interface ImportSummary {
  documentId: string;
  documentType: UploadedFinancialDocumentType;
  accountId: string;
  accountNickname: string;
  action: "UPDATED" | "CREATED" | "REJECTED";
  previousBalance: number | null;
  newBalance: number | null;
  transactionsImported: number;
  duplicatesSkipped: number;
  recurringDetected: number;
  safeToSpendBefore: number;
  safeToSpendAfter: number;
  monthEndBufferBefore: number;
  monthEndBufferAfter: number;
  creditUtilizationBefore: number | null;
  creditUtilizationAfter: number | null;
  warnings: string[];
  recommendedNextAction?: string;
  message: string;
  undoToken?: string;
}

export interface FinancialStateSnapshot {
  userId: string;
  asOfDate: string;
  dashboard: import("@/lib/engine").DashboardSnapshot;
  calculatedAt: string;
}

export interface UndoImportResult {
  success: boolean;
  message: string;
  restoredBalance?: number;
}
