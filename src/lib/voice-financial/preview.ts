import type { VoiceFinancialCommand } from "./schemas";
import { formatMoney } from "@/lib/utils/money";

export function buildVoicePreview(
  command: VoiceFinancialCommand,
  accounts: Array<{ id: string; nickname: string; accountLastFour?: string | null }>
) {
  const accountLabel = (id?: string) => {
    if (!id) return "—";
    const a = accounts.find((x) => x.id === id);
    if (!a) return id;
    const suffix = a.accountLastFour ? ` ••••${a.accountLastFour}` : "";
    return `${a.nickname}${suffix}`;
  };

  switch (command.intent) {
    case "RECORD_EXPENSE":
    case "RECORD_PAYMENT":
      return {
        title: command.intent === "RECORD_PAYMENT" ? "Record this payment?" : "Record this expense?",
        lines: [
          { label: "From", value: accountLabel(command.sourceAccountId) },
          { label: "Paid to", value: command.payeeName ?? command.merchantName },
          { label: "Amount", value: command.amount != null ? formatMoney(command.amount) : "—" },
          { label: "Date", value: command.transactionDate },
          { label: "Status", value: command.status ?? "Cleared" },
          { label: "Category", value: command.category ?? "—" },
          { label: "Balance before", value: command.previousBalance != null ? formatMoney(command.previousBalance) : "—" },
          { label: "Balance after", value: command.projectedBalance != null ? formatMoney(command.projectedBalance) : "—" },
        ],
        note: command.ownershipScope === "BUSINESS"
          ? "This expense will not be counted as personal spending."
          : "This will update your dashboard, safe-to-spend, calendar, forecasts, and account activity.",
        isNewPayee: command.isNewPayee,
        payeeName: command.payeeName,
      };

    case "RECORD_INCOME":
      return {
        title: "Record this income?",
        lines: [
          { label: "Into", value: accountLabel(command.destinationAccountId) },
          { label: "Amount", value: command.amount != null ? formatMoney(command.amount) : "—" },
          { label: "Description", value: command.description ?? "Income" },
          { label: "Date", value: command.transactionDate },
          { label: "Status", value: "Cleared" },
        ],
        note: "This will update your dashboard and account activity.",
      };

    case "RECORD_TRANSFER":
      return {
        title: "Record internal transfer?",
        lines: [
          { label: "From", value: accountLabel(command.sourceAccountId) },
          { label: "To", value: accountLabel(command.destinationAccountId) },
          { label: "Amount", value: command.amount != null ? formatMoney(command.amount) : "—" },
          { label: "Date", value: command.transactionDate ?? "Today" },
        ],
        note: "This will not be counted as income or spending.",
      };

    case "UPDATE_ACCOUNT_BALANCE":
    case "UPDATE_CREDIT_CARD_BALANCE":
      return {
        title: "Update account balance?",
        lines: [
          { label: "Account", value: accountLabel(command.destinationAccountId) },
          { label: "Current balance", value: command.previousBalance != null ? formatMoney(command.previousBalance) : "—" },
          { label: "New balance", value: command.amount != null ? formatMoney(command.amount) : "—" },
        ],
        note: "This will recalculate all financial metrics.",
      };

    case "MARK_BILL_PAID":
      return {
        title: `Mark ${command.payeeName ?? "bill"} paid?`,
        lines: [
          { label: "Bill", value: command.payeeName },
          { label: "From", value: accountLabel(command.sourceAccountId) },
        ],
        note: "Next due date will advance by one period.",
      };

    default:
      return {
        title: "Review this update?",
        lines: [],
        note: command.warnings.join(" "),
      };
  }
}

export function getSuggestedPhrases(accountType: string): string[] {
  const t = accountType.toUpperCase();
  if (t.includes("CREDIT")) {
    return [
      "I charged $300 at Porsche to this card.",
      "I paid $5,000 toward this card from PenFed.",
      "My balance is now $10,000.",
    ];
  }
  if (t.includes("LOAN") || t.includes("MORTGAGE")) {
    return [
      "I paid $4,097 toward this loan yesterday.",
      "Update the loan balance to $50,000.",
      "Mark the mortgage payment cleared.",
    ];
  }
  if (t.includes("SAVINGS")) {
    return [
      "Move $1,000 into savings.",
      "Withdraw $500 from savings.",
      "Protect $10,000 as emergency savings.",
    ];
  }
  return [
    "I paid $500 to Victor.",
    "A $5,000 paycheck came in.",
    "My balance is now $24,500.",
    "Transfer $2,900 to Wells Fargo.",
    "Mark the mortgage payment cleared.",
  ];
}
