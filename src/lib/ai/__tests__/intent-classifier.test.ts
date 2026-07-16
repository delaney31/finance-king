import { describe, it, expect } from "vitest";
import { classifyIntentRules } from "../providers/rules-based";

describe("Intent classifier", () => {
  it("classifies safe-to-spend questions", () => {
    const result = classifyIntentRules("How much can I safely spend today?");
    expect(result.intent).toBe("SAFE_TO_SPEND");
    expect(result.extractedParams.horizon).toBe("today");
  });

  it("classifies can-I-afford questions with amount", () => {
    const result = classifyIntentRules("Can Pacific Luxe spend $500 on advertising?");
    expect(result.intent).toBe("CAN_I_AFFORD");
    expect(result.extractedParams.amount).toBe(500);
    expect(result.extractedParams.isBusiness).toBe(true);
  });

  it("classifies Disneyland affordability", () => {
    const result = classifyIntentRules("Can I take my daughter to Disneyland?");
    expect(result.intent).toBe("CAN_I_AFFORD");
    expect(result.extractedParams.purchaseName).toMatch(/disneyland/i);
  });

  it("classifies explain-metric questions", () => {
    const result = classifyIntentRules("Why is my safe-to-spend amount low?");
    expect(result.intent).toBe("EXPLAIN_METRIC");
    expect(result.extractedParams.metricName).toBe("safe_to_spend");
  });

  it("classifies debt payment questions", () => {
    const result = classifyIntentRules("How much should I pay toward Amex?");
    expect(result.intent).toBe("DEBT_PAYMENT");
    expect(result.extractedParams.debtName).toMatch(/amex/i);
  });

  it("classifies income delay questions", () => {
    const result = classifyIntentRules("What happens if my contract payment is delayed?");
    expect(result.intent).toBe("INCOME_DELAY");
  });

  it("classifies overdraft risk", () => {
    const result = classifyIntentRules("Am I at risk of an overdraft?");
    expect(result.intent).toBe("OVERDRAFT_RISK");
  });

  it("classifies account routing", () => {
    const result = classifyIntentRules("Which account should pay the NY mortgage?");
    expect(result.intent).toBe("ACCOUNT_ROUTING");
  });
});
