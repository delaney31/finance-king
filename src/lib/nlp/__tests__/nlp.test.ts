import { describe, it, expect } from "vitest";
import { parseSpokenNumberPhrase, replaceSpokenAmounts, parseAmountFromText } from "../spoken-numbers";
import { parseSpokenDate } from "../spoken-dates";
import { normalizeCfoMessage } from "../normalize-message";

describe("spoken numbers", () => {
  it("parses twenty-six thousand four hundred fifty", () => {
    expect(parseSpokenNumberPhrase("twenty six thousand four hundred fifty")).toBe(26450);
  });

  it("parses five grand", () => {
    const { text } = replaceSpokenAmounts("five grand");
    expect(text).toMatch(/\$5,?000/);
  });

  it("parses twenty-nine hundred", () => {
    expect(parseSpokenNumberPhrase("twenty nine hundred")).toBe(2900);
  });

  it("parses thirteen hundred", () => {
    expect(parseSpokenNumberPhrase("thirteen hundred")).toBe(1300);
  });

  it("parses fifty-two hundred via normalization", () => {
    const msg = normalizeCfoMessage("update the rental account to fifty two hundred");
    expect(parseAmountFromText(msg)).toBe(5200);
  });
});

describe("spoken dates", () => {
  it("parses August fifth", () => {
    const d = parseSpokenDate("august fifth");
    expect(d).toMatch(/-08-05$/);
  });

  it("parses August thirteenth", () => {
    const d = parseSpokenDate("august thirteenth");
    expect(d).toMatch(/-08-13$/);
  });
});

describe("normalize CFO message", () => {
  it("normalizes Wells account balance phrase", () => {
    const msg = normalizeCfoMessage("My Wells Fargo account has thirteen hundred dollars now");
    expect(msg.toLowerCase()).toContain("wells fargo");
    expect(parseAmountFromText(msg)).toBe(1300);
  });

  it("normalizes rental business advertising", () => {
    const msg = normalizeCfoMessage("Can the rental business spend five hundred on ads");
    expect(msg.toLowerCase()).toContain("pacific luxe");
    expect(msg.toLowerCase()).toContain("advertising");
  });
});
