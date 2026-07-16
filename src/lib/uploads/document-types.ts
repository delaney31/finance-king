import type { UploadedFinancialDocumentType } from "./types";

export const DOCUMENT_TYPE_OPTIONS: { value: UploadedFinancialDocumentType; label: string }[] = [
  { value: "CHECKING", label: "Checking account" },
  { value: "SAVINGS", label: "Savings account" },
  { value: "MONEY_MARKET", label: "Money-market account" },
  { value: "CREDIT_CARD", label: "Credit card" },
  { value: "LOAN", label: "Loan" },
  { value: "TRANSACTION_STATEMENT", label: "Transaction statement" },
  { value: "UNKNOWN", label: "Unknown / unsupported" },
];

const CHECKING_TYPES = new Set(["CHECKING", "BUSINESS_CHECKING", "JOINT_CHECKING"]);
const SAVINGS_TYPES = new Set(["SAVINGS", "BUSINESS_SAVINGS", "JOINT_SAVINGS"]);
const MONEY_MARKET_TYPES = new Set(["MONEY_MARKET"]);
const DEPOSIT_TYPES = new Set([...CHECKING_TYPES, ...SAVINGS_TYPES, ...MONEY_MARKET_TYPES]);
const CREDIT_TYPES = new Set(["CREDIT_CARD"]);
const LOAN_TYPES = new Set(["VEHICLE_LOAN", "MORTGAGE", "PERSONAL_LOAN"]);

/** Map legacy OCR payloads to the explicit review enum. */
export function normalizeDocumentType(
  type: string | undefined,
  rawText?: string
): UploadedFinancialDocumentType {
  if (type === "DEPOSIT_ACCOUNT") {
    if (rawText && /\bmoney market\b/i.test(rawText)) return "MONEY_MARKET";
    if (rawText && /\bsavings\b/i.test(rawText)) return "SAVINGS";
    return "CHECKING";
  }
  const valid: UploadedFinancialDocumentType[] = [
    "CHECKING",
    "SAVINGS",
    "MONEY_MARKET",
    "CREDIT_CARD",
    "LOAN",
    "TRANSACTION_STATEMENT",
    "UNKNOWN",
  ];
  if (type && valid.includes(type as UploadedFinancialDocumentType)) {
    return type as UploadedFinancialDocumentType;
  }
  return "UNKNOWN";
}

export function accountTypeForDocument(documentType: UploadedFinancialDocumentType): string {
  switch (documentType) {
    case "CHECKING":
      return "CHECKING";
    case "SAVINGS":
      return "SAVINGS";
    case "MONEY_MARKET":
      return "MONEY_MARKET";
    case "CREDIT_CARD":
      return "CREDIT_CARD";
    case "LOAN":
      return "PERSONAL_LOAN";
    case "TRANSACTION_STATEMENT":
      return "CHECKING";
    default:
      return "CHECKING";
  }
}

export function isDepositDocumentType(
  documentType: UploadedFinancialDocumentType
): documentType is "CHECKING" | "SAVINGS" | "MONEY_MARKET" {
  return documentType === "CHECKING" || documentType === "SAVINGS" || documentType === "MONEY_MARKET";
}

export function isAccountCompatibleWithDocument(
  documentType: UploadedFinancialDocumentType,
  accountType: string
): boolean {
  if (documentType === "UNKNOWN") return false;
  if (documentType === "TRANSACTION_STATEMENT") return true;
  if (documentType === "CHECKING") return CHECKING_TYPES.has(accountType);
  if (documentType === "SAVINGS") return SAVINGS_TYPES.has(accountType) || MONEY_MARKET_TYPES.has(accountType);
  if (documentType === "MONEY_MARKET") return MONEY_MARKET_TYPES.has(accountType) || SAVINGS_TYPES.has(accountType);
  if (documentType === "CREDIT_CARD") return CREDIT_TYPES.has(accountType);
  if (documentType === "LOAN") return LOAN_TYPES.has(accountType);
  return false;
}

export interface AccountOption {
  id: string;
  nickname: string;
  institution: string;
  accountType: string;
}

export function filterCompatibleAccounts(
  documentType: UploadedFinancialDocumentType,
  accounts: AccountOption[]
): AccountOption[] {
  if (documentType === "UNKNOWN") return [];
  return accounts.filter((a) => isAccountCompatibleWithDocument(documentType, a.accountType));
}

export function documentTypeLabel(documentType: UploadedFinancialDocumentType): string {
  return DOCUMENT_TYPE_OPTIONS.find((o) => o.value === documentType)?.label ?? documentType;
}

export function updateExistingLabel(documentType: UploadedFinancialDocumentType): string {
  switch (documentType) {
    case "CHECKING":
      return "Update existing checking account";
    case "SAVINGS":
      return "Update existing savings account";
    case "MONEY_MARKET":
      return "Update existing money-market account";
    case "CREDIT_CARD":
      return "Update existing credit card";
    case "LOAN":
      return "Update existing loan";
    case "TRANSACTION_STATEMENT":
      return "Import into existing account";
    default:
      return "Update existing account";
  }
}

export function createNewLabel(documentType: UploadedFinancialDocumentType): string {
  switch (documentType) {
    case "CHECKING":
      return "Create new checking account";
    case "SAVINGS":
      return "Create new savings account";
    case "MONEY_MARKET":
      return "Create new money-market account";
    case "CREDIT_CARD":
      return "Create new credit card";
    case "LOAN":
      return "Create new loan";
    case "TRANSACTION_STATEMENT":
      return "Create account and import transactions";
    default:
      return "Create new account";
  }
}

export interface ReviewFormValues {
  documentType: UploadedFinancialDocumentType | "";
  action: "UPDATE_EXISTING" | "CREATE_NEW" | "UNSUPPORTED" | "";
  accountId: string;
  nickname: string;
  institution: string;
  accountLastFour: string;
  currentBalance: string;
  availableBalance: string;
  pendingBalance: string;
  statementBalance: string;
  creditLimit: string;
  availableCredit: string;
  minimumPayment: string;
  paymentDueDate: string;
  statementCloseDate: string;
  statementDate: string;
  apr: string;
  payoffAmount: string;
  interestRate: string;
  monthlyPayment: string;
  maturityDate: string;
  ownershipType: string;
  designation: string;
  protectedBalance: string;
  minimumTargetBalance: string;
  autopayEnabled: boolean;
  typeManuallyConfirmed: boolean;
  lowConfidenceAcknowledged: boolean;
}

export function requiresManualTypeSelection(
  detectedType: UploadedFinancialDocumentType,
  confidence: number
): boolean {
  return detectedType === "UNKNOWN" || confidence < 0.7;
}

export function validateReviewForm(values: ReviewFormValues & { needsManualType: boolean }): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!values.action) {
    errors.push("Choose whether to update an existing account or create a new one.");
  }

  if (values.action === "UNSUPPORTED") {
    return { valid: true, errors };
  }

  if (!values.documentType || values.documentType === "UNKNOWN") {
    errors.push("Select a financial document type.");
  }

  if (values.needsManualType && !values.typeManuallyConfirmed) {
    errors.push("Confirm the financial document type before importing.");
  }

  if (!values.institution.trim()) {
    errors.push("Institution is required.");
  }

  if (values.action === "UPDATE_EXISTING" && !values.accountId) {
    errors.push("Select a compatible existing account.");
  }

  if (values.action === "CREATE_NEW" && !values.nickname.trim()) {
    errors.push("Account nickname is required.");
  }

  const docType = values.documentType as UploadedFinancialDocumentType;

  if (isDepositDocumentType(docType) && !values.currentBalance.trim()) {
    errors.push("Current balance is required.");
  }

  if (docType === "CREDIT_CARD") {
    if (!values.currentBalance.trim()) errors.push("Current balance is required.");
    if (!values.creditLimit.trim()) errors.push("Credit limit is required.");
  }

  if (docType === "LOAN" && !values.currentBalance.trim() && !values.payoffAmount.trim()) {
    errors.push("Principal or payoff balance is required.");
  }

  if (
    docType === "TRANSACTION_STATEMENT" &&
    values.action === "UPDATE_EXISTING" &&
    !values.accountId
  ) {
    errors.push("Select an account for transaction import.");
  }

  return { valid: errors.length === 0, errors };
}
