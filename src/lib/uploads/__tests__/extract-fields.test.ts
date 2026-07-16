import { describe, it, expect } from "vitest";
import { buildExtractedFinancialData } from "../extract-fields";

describe("buildExtractedFinancialData", () => {
  it("extracts checking account balances and institution", () => {
    const text = `
      PenFed Credit Union Checking
      Current Balance: $24,032.25
      Available Balance: $23,800.00
      Account ending in 4521
    `;
    const data = buildExtractedFinancialData(text);
    expect(data.documentType).toBe("CHECKING");
    expect(data.institution).toBe("PenFed");
    expect(data.accountLastFour).toBe("4521");
    expect(data.currentBalance).toBe(24032.25);
    expect(data.availableBalance).toBe(23800);
  });

  it("extracts credit card fields", () => {
    const text = `
      American Express Credit Card
      Current Balance: $30,000.00
      Credit Limit: $35,000.00
      Minimum Payment: $750.00
      APR: 19.99%
      Card ending 1005
    `;
    const data = buildExtractedFinancialData(text);
    expect(data.documentType).toBe("CREDIT_CARD");
    expect(data.creditLimit).toBe(35000);
    expect(data.minimumPayment).toBe(750);
    expect(data.apr).toBe(19.99);
  });

  it("extracts transactions with pending status", () => {
    const text = `
      Checking Account
      Current Balance: $1,000.00
      07/01/2025 Pending Deposit +$500.00 Payroll
      07/02/2025 Grocery -$45.20
    `;
    const data = buildExtractedFinancialData(text);
    expect(data.transactions.length).toBeGreaterThanOrEqual(1);
    const pending = data.transactions.find((t) => t.status === "PENDING");
    expect(pending).toBeDefined();
  });

  it("flags low-confidence when institution is missing", () => {
    const data = buildExtractedFinancialData("Random text with no financial labels");
    expect(data.documentType).toBe("UNKNOWN");
    expect(data.classification.confidence).toBe(0);
  });
});
