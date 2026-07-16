import { describe, it, expect } from "vitest";
import {
  filterCompatibleAccounts,
  createNewLabel,
  updateExistingLabel,
  validateReviewForm,
  requiresManualTypeSelection,
  isAccountCompatibleWithDocument,
  accountTypeForDocument,
  normalizeDocumentType,
} from "../document-types";

const accounts = [
  { id: "chk", nickname: "PenFed Checking", institution: "PenFed", accountType: "CHECKING" },
  { id: "sav", nickname: "PenFed Savings", institution: "PenFed", accountType: "SAVINGS" },
  { id: "cc", nickname: "Amex", institution: "Amex", accountType: "CREDIT_CARD" },
];

describe("document type review", () => {
  it("requires manual type selection for UNKNOWN uploads", () => {
    expect(requiresManualTypeSelection("UNKNOWN", 0)).toBe(true);
    expect(requiresManualTypeSelection("CHECKING", 0.5)).toBe(true);
    expect(requiresManualTypeSelection("CHECKING", 0.8)).toBe(false);
  });

  it("shows credit card create label", () => {
    expect(createNewLabel("CREDIT_CARD")).toBe("Create new credit card");
    expect(updateExistingLabel("CREDIT_CARD")).toBe("Update existing credit card");
  });

  it("shows savings create label", () => {
    expect(createNewLabel("SAVINGS")).toBe("Create new savings account");
  });

  it("filters compatible accounts for credit card", () => {
    const filtered = filterCompatibleAccounts("CREDIT_CARD", accounts);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("cc");
  });

  it("filters compatible accounts for savings", () => {
    const filtered = filterCompatibleAccounts("SAVINGS", accounts);
    expect(filtered.map((a) => a.id)).toContain("sav");
    expect(filtered.map((a) => a.id)).not.toContain("cc");
  });

  it("prevents credit card from matching checking account", () => {
    expect(isAccountCompatibleWithDocument("CREDIT_CARD", "CHECKING")).toBe(false);
    expect(isAccountCompatibleWithDocument("CREDIT_CARD", "CREDIT_CARD")).toBe(true);
  });

  it("prevents savings upload from creating credit card account type", () => {
    expect(accountTypeForDocument("SAVINGS")).toBe("SAVINGS");
    expect(accountTypeForDocument("CREDIT_CARD")).toBe("CREDIT_CARD");
  });

  it("keeps confirm disabled until valid", () => {
    const invalid = validateReviewForm({
      documentType: "",
      action: "",
      accountId: "",
      nickname: "",
      institution: "",
      accountLastFour: "",
      currentBalance: "",
      availableBalance: "",
      pendingBalance: "",
      statementBalance: "",
      creditLimit: "",
      availableCredit: "",
      minimumPayment: "",
      paymentDueDate: "",
      statementCloseDate: "",
      statementDate: "",
      apr: "",
      payoffAmount: "",
      interestRate: "",
      monthlyPayment: "",
      maturityDate: "",
      ownershipType: "INDIVIDUAL",
      designation: "PERSONAL",
      protectedBalance: "",
      minimumTargetBalance: "",
      autopayEnabled: false,
      typeManuallyConfirmed: false,
      lowConfidenceAcknowledged: true,
      needsManualType: true,
    });
    expect(invalid.valid).toBe(false);

    const valid = validateReviewForm({
      documentType: "CREDIT_CARD",
      action: "CREATE_NEW",
      accountId: "",
      nickname: "Amex",
      institution: "Amex",
      accountLastFour: "1005",
      currentBalance: "30000",
      availableBalance: "",
      pendingBalance: "",
      statementBalance: "",
      creditLimit: "35000",
      availableCredit: "",
      minimumPayment: "750",
      paymentDueDate: "",
      statementCloseDate: "",
      statementDate: "",
      apr: "19.99",
      payoffAmount: "",
      interestRate: "",
      monthlyPayment: "",
      maturityDate: "",
      ownershipType: "INDIVIDUAL",
      designation: "PERSONAL",
      protectedBalance: "",
      minimumTargetBalance: "",
      autopayEnabled: false,
      typeManuallyConfirmed: true,
      lowConfidenceAcknowledged: true,
      needsManualType: false,
    });
    expect(valid.valid).toBe(true);
  });

  it("maps legacy DEPOSIT_ACCOUNT to checking or savings", () => {
    expect(normalizeDocumentType("DEPOSIT_ACCOUNT", "PenFed Savings")).toBe("SAVINGS");
    expect(normalizeDocumentType("DEPOSIT_ACCOUNT", "PenFed Checking")).toBe("CHECKING");
  });
});
