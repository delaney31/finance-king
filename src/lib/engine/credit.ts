import { addMonths, format } from "date-fns";
import type { CreditCardState, PayoffPlan } from "./types";

export function computeUtilizationTargets(
  cards: CreditCardState[]
): { threshold: number; paymentNeeded: number; newUtilization: number }[] {
  const thresholds = [0.3, 0.1, 0.05];
  const results: { threshold: number; paymentNeeded: number; newUtilization: number }[] = [];

  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  const totalBalance = cards.reduce((s, c) => s + c.balance, 0);

  for (const threshold of thresholds) {
    const targetBalance = totalLimit * threshold;
    const paymentNeeded = Math.max(0, totalBalance - targetBalance);
    const newUtilization =
      totalLimit > 0 ? Math.max(0, totalBalance - paymentNeeded) / totalLimit : 0;
    results.push({ threshold, paymentNeeded, newUtilization });
  }

  return results;
}

export function buildAvalanchePlan(
  cards: CreditCardState[],
  monthlyBudget: number
): PayoffPlan {
  const sorted = [...cards].sort((a, b) => b.apr - a.apr);
  return buildPayoffPlan(sorted, monthlyBudget, "avalanche");
}

export function buildSnowballPlan(
  cards: CreditCardState[],
  monthlyBudget: number
): PayoffPlan {
  const sorted = [...cards].sort((a, b) => a.balance - b.balance);
  return buildPayoffPlan(sorted, monthlyBudget, "snowball");
}

function buildPayoffPlan(
  cards: CreditCardState[],
  monthlyBudget: number,
  strategy: "avalanche" | "snowball"
): PayoffPlan {
  const balances = new Map(cards.map((c) => [c.id, c.balance]));
  const payments: PayoffPlan["payments"] = [];
  let totalInterest = 0;
  let month = 0;
  const startDate = new Date();

  while ([...balances.values()].some((b) => b > 0) && month < 120) {
    month++;
    const monthDate = format(addMonths(startDate, month), "yyyy-MM");
    let remaining = monthlyBudget;

    for (const card of cards) {
      const minPay = Math.min(card.minimumPayment, balances.get(card.id) ?? 0);
      if (minPay > 0 && remaining >= minPay) {
        const bal = (balances.get(card.id) ?? 0) - minPay;
        balances.set(card.id, Math.max(0, bal));
        remaining -= minPay;
        const interest = ((balances.get(card.id) ?? 0) * card.apr) / 12;
        totalInterest += interest;
        balances.set(card.id, (balances.get(card.id) ?? 0) + interest);
        payments.push({
          month: monthDate,
          cardId: card.id,
          amount: minPay,
          remainingBalance: balances.get(card.id) ?? 0,
        });
      }
    }

    const target = cards.find((c) => (balances.get(c.id) ?? 0) > 0);
    if (target && remaining > 0) {
      const pay = Math.min(remaining, balances.get(target.id) ?? 0);
      balances.set(target.id, (balances.get(target.id) ?? 0) - pay);
      payments.push({
        month: monthDate,
        cardId: target.id,
        amount: pay,
        remainingBalance: balances.get(target.id) ?? 0,
      });
    }
  }

  return {
    strategy,
    monthlyPayment: monthlyBudget,
    payoffDate: format(addMonths(startDate, month), "yyyy-MM-dd"),
    totalInterest,
    payments,
  };
}

export const CREDIT_DISCLAIMER =
  "Credit score estimates are educational only. Credit bureaus and scoring models may calculate scores differently. Payment history, utilization, age, account mix, inquiries, and derogatory records all affect outcomes. Do not drain emergency savings solely to optimize utilization.";
