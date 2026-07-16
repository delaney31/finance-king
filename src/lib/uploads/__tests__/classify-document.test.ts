import { describe, it, expect } from "vitest";
import { classifyFinancialDocument } from "../classify-document";

describe("classifyFinancialDocument", () => {
  it("classifies checking screenshots as CHECKING", () => {
    const text = `PenFed Checking Current Balance: $24,032.25 Available Balance: $23,800.00`;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("CHECKING");
  });

  it("classifies savings screenshots as SAVINGS", () => {
    const text = `PenFed Savings Current Balance: $40,000.01`;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("SAVINGS");
  });

  it("classifies credit card screenshots as CREDIT_CARD", () => {
    const text = `American Express Credit Card Credit Limit: $35,000 Minimum Payment: $750`;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("CREDIT_CARD");
  });

  it("classifies loan screenshots as LOAN", () => {
    const text = `Auto Loan Principal Balance: $18,400 Monthly Payment: $570`;
    const result = classifyFinancialDocument(text);
    expect(result.type).toBe("LOAN");
  });

  it("returns UNKNOWN for low-signal documents", () => {
    expect(classifyFinancialDocument("Hello").type).toBe("UNKNOWN");
  });
});
