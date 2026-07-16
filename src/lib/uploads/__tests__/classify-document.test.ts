import { describe, it, expect } from "vitest";
import { classifyFinancialDocument, inferDepositAccountType } from "../classify-document";

describe("classifyFinancialDocument", () => {
  it("classifies checking screenshots as DEPOSIT_ACCOUNT", () => {
    const text = `
      PenFed Credit Union
      Checking Account
      Current Balance: $24,032.25
      Available Balance: $23,800.00
      Pending transactions: $232.25
      Account ending in 4521
    `;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("DEPOSIT_ACCOUNT");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.reasons).toContain("checking label");
  });

  it("classifies savings screenshots as DEPOSIT_ACCOUNT", () => {
    const text = `
      PenFed Savings
      Current Balance: $40,000.01
      Available Balance: $40,000.01
      Deposits
    `;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("DEPOSIT_ACCOUNT");
    expect(inferDepositAccountType(text)).toBe("SAVINGS");
  });

  it("classifies credit card screenshots as CREDIT_CARD", () => {
    const text = `
      American Express
      Credit Card
      Current Balance: $30,000.00
      Statement Balance: $28,500.00
      Available Credit: $5,000.00
      Credit Limit: $35,000.00
      Minimum Payment: $750.00
      Payment Due Date: 07/25/2025
      APR: 19.99%
    `;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("CREDIT_CARD");
    expect(result.reasons).toContain("credit card label");
  });

  it("classifies loan screenshots as LOAN", () => {
    const text = `
      Auto Loan
      Principal Balance: $18,400.00
      Monthly Payment: $570.00
      Interest Rate: 4.5%
      Payoff Amount: $17,200.00
      Maturity Date: 03/15/2028
    `;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("LOAN");
    expect(result.reasons).toContain("principal balance");
  });

  it("classifies transaction statements", () => {
    const text = `
      Statement Period: 06/01/2025 - 06/30/2025
      Transactions
      Posted Date  Description  Amount
      06/02/2025   Grocery      -$45.20
    `;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("TRANSACTION_STATEMENT");
  });

  it("returns UNKNOWN for low-signal documents", () => {
    const result = classifyFinancialDocument("Hello world");
    expect(result.type).toBe("UNKNOWN");
    expect(result.confidence).toBe(0);
  });
});
