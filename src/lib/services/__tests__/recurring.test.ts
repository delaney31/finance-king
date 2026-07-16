import { describe, it, expect } from "vitest";
import { detectRecurringPatterns } from "@/lib/services/recurring";

describe("recurring detection", () => {
  it("detects monthly patterns", () => {
    const transactions = [
      { description: "NY MORTGAGE", amount: -8200, date: "2025-05-01" },
      { description: "NY MORTGAGE", amount: -8200, date: "2025-06-01" },
      { description: "NY MORTGAGE", amount: -8200, date: "2025-07-01" },
      { description: "NETFLIX", amount: -15.99, date: "2025-05-10" },
      { description: "NETFLIX", amount: -15.99, date: "2025-06-10" },
    ];

    const patterns = detectRecurringPatterns(transactions);
    expect(patterns.length).toBeGreaterThan(0);
    const mortgage = patterns.find((p) => p.name.includes("MORTGAGE"));
    expect(mortgage?.typicalAmount).toBe(8200);
    expect(mortgage?.confidence).toBeGreaterThan(0.8);
  });
});
