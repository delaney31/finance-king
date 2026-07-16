import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = number | string | Decimal;

export function toDecimal(value: MoneyInput): Decimal {
  return new Decimal(value);
}

export function formatMoney(value: MoneyInput, compact = false): string {
  const d = toDecimal(value);
  if (compact && d.abs().gte(1_000_000)) {
    return `$${d.div(1_000_000).toFixed(1)}M`;
  }
  if (compact && d.abs().gte(10_000)) {
    return `$${d.div(1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(d.toNumber());
}

export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));
}

export function maxMoney(a: MoneyInput, b: MoneyInput): Decimal {
  const da = toDecimal(a);
  const db = toDecimal(b);
  return da.gte(db) ? da : db;
}

export function minMoney(a: MoneyInput, b: MoneyInput): Decimal {
  const da = toDecimal(a);
  const db = toDecimal(b);
  return da.lte(db) ? da : db;
}

export function decimalToNumber(d: Decimal): number {
  return d.toDecimalPlaces(2).toNumber();
}
