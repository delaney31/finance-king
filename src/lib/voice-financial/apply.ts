import { prisma } from "@/lib/db";
import { recalculateFinancialState, getLatestFinancialState } from "@/lib/financial-state/recalculate";
import type { FinancialStateSnapshot } from "@/lib/financial-state/types";
import { createActivityEvent } from "./activity-service";
import { upsertPayeeUsage } from "./payee-service";
import {
  voiceFinancialCommandSchema,
  type VoiceFinancialCommand,
  type VoiceFinancialUpdateResult,
} from "./schemas";

function metricChanges(
  before: FinancialStateSnapshot,
  after: FinancialStateSnapshot
): VoiceFinancialUpdateResult["metricChanges"] {
  const pairs: Array<[string, keyof FinancialStateSnapshot]> = [
    ["Total liquid cash", "totalLiquidCash"],
    ["Personal operating cash", "personalOperatingCash"],
    ["Safe to spend today", "safeToSpendToday"],
    ["Month-end buffer", "monthEndProjectedCash"],
    ["Year-end buffer", "yearEndProjectedCash"],
  ];
  return pairs.map(([metric, key]) => ({
    metric,
    before: before[key] as number,
    after: after[key] as number,
    difference: (after[key] as number) - (before[key] as number),
  }));
}

export async function applyVoiceFinancialCommand(
  userId: string,
  command: VoiceFinancialCommand,
  meta?: { requestId?: string; deviceInfo?: string }
): Promise<VoiceFinancialUpdateResult> {
  const parsed = voiceFinancialCommandSchema.safeParse(command);
  if (!parsed.success) {
    return {
      success: false,
      message: "Invalid command",
      updatedEntities: [],
      previousSnapshotId: "",
      newSnapshotId: "",
      metricChanges: [],
      warnings: parsed.error.errors.map((e) => e.message),
    };
  }

  const cmd = parsed.data;
  if (cmd.missingFields.length > 0) {
    return {
      success: false,
      message: cmd.clarificationQuestion ?? "Missing required fields",
      updatedEntities: [],
      previousSnapshotId: "",
      newSnapshotId: "",
      metricChanges: [],
      warnings: cmd.warnings,
    };
  }

  const beforeState =
    (await getLatestFinancialState(userId)) ??
    (await recalculateFinancialState(userId, { reason: "pre-voice baseline" }));

  const updatedEntities: VoiceFinancialUpdateResult["updatedEntities"] = [];
  const activityEventIds: string[] = [];
  const previousValues: Record<string, unknown> = {};
  let auditId = "";

  try {
    await prisma.$transaction(async (tx) => {
      const audit = await tx.auditLog.create({
        data: {
          userId,
          action: "VOICE_FINANCIAL_COMMAND_APPLIED",
          entityType: cmd.intent,
          metadata: {
            command: cmd,
            previousSnapshotId: beforeState.id,
            originalTranscript: cmd.transcript,
            confirmedAt: new Date().toISOString(),
            requestId: meta?.requestId,
            deviceInfo: meta?.deviceInfo,
          },
        },
      });
      auditId = audit.id;

      const recordActivity = async (input: Parameters<typeof createActivityEvent>[0]) => {
        const event = await tx.accountActivityEvent.create({
          data: {
            userId: input.userId,
            accountId: input.accountId,
            eventType: input.eventType,
            description: input.description,
            source: input.source,
            auditLogId: input.auditLogId,
            effectiveDate: input.effectiveDate ?? new Date(),
            previousBalance: input.previousBalance,
            newBalance: input.newBalance,
            amount: input.amount,
            transactionId: input.transactionId,
            relatedAccountId: input.relatedAccountId,
            payee: input.payee,
            category: input.category,
            originalTranscript: input.originalTranscript,
          },
        });
        activityEventIds.push(event.id);
        return event;
      };

      switch (cmd.intent) {
        case "RECORD_EXPENSE":
        case "RECORD_PAYMENT": {
          const accountId = cmd.sourceAccountId!;
          const account = await tx.financialAccount.findFirst({ where: { id: accountId, userId } });
          if (!account) throw new Error("Account not found");

          const prevBal = Number(account.currentBalance);
          const newBal = prevBal - cmd.amount!;
          previousValues.expense = { accountId, prevBal, transactionIds: [] as string[] };

          const txn = await tx.transaction.create({
            data: {
              userId,
              accountId,
              amount: -cmd.amount!,
              date: new Date(cmd.transactionDate ?? new Date()),
              description: cmd.payeeName ?? cmd.merchantName ?? "Payment",
              merchant: cmd.payeeName ?? cmd.merchantName,
              type: "EXPENSE",
              clearanceStatus: cmd.status === "PENDING" ? "PENDING" : "CLEARED",
              isPending: cmd.status === "PENDING",
            },
          });
          (previousValues.expense as { transactionIds: string[] }).transactionIds.push(txn.id);

          await tx.financialAccount.update({
            where: { id: accountId },
            data: { currentBalance: newBal },
          });

          await tx.accountBalanceSnapshot.create({
            data: {
              accountId,
              balance: newBal,
              asOfDate: new Date(),
              source: "MANUAL",
              notes: `Voice: ${cmd.payeeName ?? "expense"}`,
            },
          });

          await recordActivity({
            userId,
            accountId,
            eventType: cmd.intent === "RECORD_PAYMENT" ? "PAYMENT_RECORDED" : "EXPENSE_RECORDED",
            description: `${cmd.payeeName ?? "Payment"} — ${cmd.amount}`,
            source: "VOICE",
            auditLogId: auditId,
            previousBalance: prevBal,
            newBalance: newBal,
            amount: cmd.amount,
            transactionId: txn.id,
            payee: cmd.payeeName,
            category: cmd.category,
            originalTranscript: cmd.transcript,
          });

          updatedEntities.push({ type: "transaction", id: txn.id, label: cmd.payeeName ?? "Expense" });
          updatedEntities.push({ type: "account", id: accountId, label: account.nickname });
          break;
        }

        case "RECORD_INCOME":
        case "RECORD_REFUND": {
          const accountId = cmd.destinationAccountId!;
          const account = await tx.financialAccount.findFirst({ where: { id: accountId, userId } });
          if (!account) throw new Error("Account not found");

          const prevBal = Number(account.currentBalance);
          const newBal = prevBal + cmd.amount!;
          previousValues.income = { accountId, prevBal };

          const txn = await tx.transaction.create({
            data: {
              userId,
              accountId,
              amount: cmd.amount!,
              date: new Date(cmd.transactionDate ?? new Date()),
              description: cmd.description ?? cmd.payeeName ?? "Income",
              type: "INCOME",
              clearanceStatus: "CLEARED",
            },
          });

          await tx.financialAccount.update({
            where: { id: accountId },
            data: { currentBalance: newBal },
          });

          await tx.accountBalanceSnapshot.create({
            data: { accountId, balance: newBal, asOfDate: new Date(), source: "MANUAL" },
          });

          await recordActivity({
            userId,
            accountId,
            eventType: "INCOME_RECORDED",
            description: `${cmd.description ?? "Income"} +${cmd.amount}`,
            source: "VOICE",
            auditLogId: auditId,
            previousBalance: prevBal,
            newBalance: newBal,
            amount: cmd.amount,
            transactionId: txn.id,
            originalTranscript: cmd.transcript,
          });

          updatedEntities.push({ type: "transaction", id: txn.id, label: "Income" });
          break;
        }

        case "RECORD_TRANSFER": {
          const [source, dest] = await Promise.all([
            tx.financialAccount.findFirst({ where: { id: cmd.sourceAccountId!, userId } }),
            tx.financialAccount.findFirst({ where: { id: cmd.destinationAccountId!, userId } }),
          ]);
          if (!source || !dest) throw new Error("Transfer accounts not found");

          const srcPrev = Number(source.currentBalance);
          const destPrev = Number(dest.currentBalance);
          const srcNew = srcPrev - cmd.amount!;
          const destNew = destPrev + cmd.amount!;
          const pairId = `xfer-${Date.now()}`;
          previousValues.transfer = {
            sourceId: source.id,
            sourceBalance: srcPrev,
            destId: dest.id,
            destBalance: destPrev,
            pairId,
          };

          await tx.financialAccount.update({ where: { id: source.id }, data: { currentBalance: srcNew } });
          await tx.financialAccount.update({ where: { id: dest.id }, data: { currentBalance: destNew } });

          const txnOut = await tx.transaction.create({
            data: {
              userId,
              accountId: source.id,
              amount: -cmd.amount!,
              date: new Date(cmd.transactionDate ?? new Date()),
              description: `Transfer to ${dest.nickname}`,
              type: "EXPENSE",
              isTransfer: true,
              transferPairId: pairId,
              clearanceStatus: "CLEARED",
            },
          });
          const txnIn = await tx.transaction.create({
            data: {
              userId,
              accountId: dest.id,
              amount: cmd.amount!,
              date: new Date(cmd.transactionDate ?? new Date()),
              description: `Transfer from ${source.nickname}`,
              type: "INCOME",
              isTransfer: true,
              transferPairId: pairId,
              clearanceStatus: "CLEARED",
            },
          });
          const txns = [txnOut, txnIn];

          await recordActivity({
            userId,
            accountId: source.id,
            eventType: "TRANSFER_SENT",
            description: `Transfer to ${dest.nickname} — ${cmd.amount}`,
            source: "VOICE",
            auditLogId: auditId,
            previousBalance: srcPrev,
            newBalance: srcNew,
            amount: cmd.amount,
            relatedAccountId: dest.id,
            transactionId: txns[0]?.id,
            originalTranscript: cmd.transcript,
          });
          await recordActivity({
            userId,
            accountId: dest.id,
            eventType: "TRANSFER_RECEIVED",
            description: `Transfer from ${source.nickname} +${cmd.amount}`,
            source: "VOICE",
            auditLogId: auditId,
            previousBalance: destPrev,
            newBalance: destNew,
            amount: cmd.amount,
            relatedAccountId: source.id,
            transactionId: txns[1]?.id,
            originalTranscript: cmd.transcript,
          });

          updatedEntities.push({ type: "transfer", id: pairId, label: `${source.nickname} → ${dest.nickname}` });
          break;
        }

        case "UPDATE_ACCOUNT_BALANCE": {
          const accountId = cmd.destinationAccountId!;
          const account = await tx.financialAccount.findFirst({ where: { id: accountId, userId } });
          if (!account) throw new Error("Account not found");
          const prevBal = Number(account.currentBalance);
          previousValues.balance = { accountId, prevBal };

          await tx.financialAccount.update({
            where: { id: accountId },
            data: { currentBalance: cmd.amount! },
          });
          await tx.accountBalanceSnapshot.create({
            data: { accountId, balance: cmd.amount!, asOfDate: new Date(), source: "MANUAL", notes: "Voice balance update" },
          });
          await recordActivity({
            userId,
            accountId,
            eventType: "BALANCE_UPDATED",
            description: `Balance updated to ${cmd.amount}`,
            source: "VOICE",
            auditLogId: auditId,
            previousBalance: prevBal,
            newBalance: cmd.amount,
            originalTranscript: cmd.transcript,
          });
          updatedEntities.push({ type: "account", id: accountId, label: account.nickname });
          break;
        }

        case "UPDATE_CREDIT_CARD_BALANCE": {
          const accountId = cmd.destinationAccountId!;
          const card = await tx.creditCard.findFirst({
            where: { accountId, userId },
            include: { account: true },
          });
          if (!card) throw new Error("Credit card not found");
          previousValues.creditCard = { id: card.id, balance: card.currentBalance };

          await tx.creditCard.update({
            where: { id: card.id },
            data: { currentBalance: cmd.amount! },
          });
          await tx.financialAccount.update({
            where: { id: accountId },
            data: { currentBalance: cmd.amount! },
          });
          await recordActivity({
            userId,
            accountId,
            eventType: "BALANCE_UPDATED",
            description: `Credit card balance updated to ${cmd.amount}`,
            source: "VOICE",
            auditLogId: auditId,
            previousBalance: Number(card.currentBalance),
            newBalance: cmd.amount,
            originalTranscript: cmd.transcript,
          });
          updatedEntities.push({ type: "credit_card", id: card.id, label: card.issuer });
          break;
        }

        case "MARK_BILL_PAID": {
          const bill = await tx.bill.findFirst({
            where: {
              userId,
              name: { contains: cmd.payeeName ?? "mortgage", mode: "insensitive" },
            },
          });
          if (!bill) throw new Error("Bill not found");
          previousValues.bill = { id: bill.id, nextDueDate: bill.nextDueDate };
          const nextMonth = bill.nextDueDate ? new Date(bill.nextDueDate) : new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          await tx.bill.update({ where: { id: bill.id }, data: { nextDueDate: nextMonth } });

          if (cmd.sourceAccountId) {
            const account = await tx.financialAccount.findFirst({
              where: { id: cmd.sourceAccountId, userId },
            });
            if (account && cmd.amount) {
              const prevBal = Number(account.currentBalance);
              const newBal = prevBal - cmd.amount;
              await tx.financialAccount.update({
                where: { id: account.id },
                data: { currentBalance: newBal },
              });
              await recordActivity({
                userId,
                accountId: account.id,
                eventType: "BILL_PAID",
                description: `${bill.name} paid`,
                source: "VOICE",
                auditLogId: auditId,
                previousBalance: prevBal,
                newBalance: newBal,
                amount: cmd.amount,
                payee: bill.name,
                originalTranscript: cmd.transcript,
              });
            }
          }

          updatedEntities.push({ type: "bill", id: bill.id, label: bill.name });
          break;
        }

        case "SCHEDULE_TRANSACTION": {
          const accountId = cmd.sourceAccountId ?? cmd.destinationAccountId;
          if (!accountId) throw new Error("Account required for scheduled transaction");
          const txn = await tx.transaction.create({
            data: {
              userId,
              accountId,
              amount: -(cmd.amount ?? 0),
              date: new Date(cmd.scheduledDate ?? cmd.transactionDate ?? new Date()),
              description: cmd.payeeName ?? "Scheduled payment",
              type: "EXPENSE",
              clearanceStatus: "PENDING",
              isPending: true,
            },
          });
          await recordActivity({
            userId,
            accountId,
            eventType: "TRANSACTION_ADDED",
            description: `Pending: ${cmd.payeeName ?? "payment"}`,
            source: "VOICE",
            auditLogId: auditId,
            amount: cmd.amount,
            transactionId: txn.id,
            payee: cmd.payeeName,
            originalTranscript: cmd.transcript,
          });
          updatedEntities.push({ type: "transaction", id: txn.id, label: "Scheduled" });
          break;
        }

        default:
          throw new Error(`Intent ${cmd.intent} not implemented`);
      }

      await tx.auditLog.update({
        where: { id: auditId },
        data: {
          metadata: {
            command: cmd,
            previousValues: previousValues as object,
            previousSnapshotId: beforeState.id,
            originalTranscript: cmd.transcript,
            confirmedAt: new Date().toISOString(),
            requestId: meta?.requestId,
          },
        },
      });
    });

    if (cmd.payeeName && cmd.isNewPayee) {
      await upsertPayeeUsage(userId, cmd.payeeName, {
        category: cmd.category,
        accountId: cmd.sourceAccountId ?? cmd.destinationAccountId,
      });
    } else if (cmd.payeeName) {
      await upsertPayeeUsage(userId, cmd.payeeName, { category: cmd.category });
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Update failed",
      updatedEntities: [],
      previousSnapshotId: beforeState.id,
      newSnapshotId: beforeState.id,
      metricChanges: [],
      warnings: [],
    };
  }

  const afterState = await recalculateFinancialState(userId, {
    reason: `Voice command: ${cmd.intent}`,
    sourceEventId: auditId,
  });

  return {
    success: true,
    message: buildSuccessMessage(cmd),
    updatedEntities,
    previousSnapshotId: beforeState.id,
    newSnapshotId: afterState.id,
    metricChanges: metricChanges(beforeState, afterState),
    warnings: cmd.warnings,
    auditId,
    activityEventIds,
  };
}

function buildSuccessMessage(cmd: VoiceFinancialCommand): string {
  switch (cmd.intent) {
    case "RECORD_EXPENSE":
    case "RECORD_PAYMENT":
      return `$${cmd.amount?.toLocaleString()} paid to ${cmd.payeeName} from account.`;
    case "RECORD_INCOME":
      return `$${cmd.amount?.toLocaleString()} income recorded.`;
    case "RECORD_TRANSFER":
      return `Transfer of $${cmd.amount?.toLocaleString()} recorded.`;
    case "UPDATE_ACCOUNT_BALANCE":
      return `Balance updated to $${cmd.amount?.toLocaleString()}.`;
    case "MARK_BILL_PAID":
      return `${cmd.payeeName ?? "Bill"} marked paid.`;
    default:
      return "Update applied.";
  }
}

export async function undoVoiceFinancialCommand(
  userId: string,
  auditId: string
): Promise<VoiceFinancialUpdateResult> {
  const audit = await prisma.auditLog.findFirst({
    where: { id: auditId, userId, action: "VOICE_FINANCIAL_COMMAND_APPLIED" },
  });
  if (!audit) {
    return {
      success: false,
      message: "Audit record not found",
      updatedEntities: [],
      previousSnapshotId: "",
      newSnapshotId: "",
      metricChanges: [],
      warnings: [],
    };
  }

  const meta = audit.metadata as {
    command: VoiceFinancialCommand;
    previousValues: Record<string, unknown>;
  };

  const beforeState =
    (await getLatestFinancialState(userId)) ??
    (await recalculateFinancialState(userId));

  try {
    await prisma.$transaction(async (tx) => {
      const pv = meta.previousValues;

      if (pv.expense && typeof pv.expense === "object") {
        const e = pv.expense as { accountId: string; prevBal: number; transactionIds?: string[] };
        await tx.financialAccount.update({
          where: { id: e.accountId },
          data: { currentBalance: e.prevBal },
        });
        if (e.transactionIds?.length) {
          await tx.transaction.deleteMany({ where: { id: { in: e.transactionIds } } });
        }
      }

      if (pv.income && typeof pv.income === "object") {
        const i = pv.income as { accountId: string; prevBal: number };
        await tx.financialAccount.update({
          where: { id: i.accountId },
          data: { currentBalance: i.prevBal },
        });
      }

      if (pv.transfer && typeof pv.transfer === "object") {
        const t = pv.transfer as {
          sourceId: string;
          sourceBalance: number;
          destId: string;
          destBalance: number;
          pairId?: string;
        };
        await tx.financialAccount.update({
          where: { id: t.sourceId },
          data: { currentBalance: t.sourceBalance },
        });
        await tx.financialAccount.update({
          where: { id: t.destId },
          data: { currentBalance: t.destBalance },
        });
        if (t.pairId) {
          await tx.transaction.deleteMany({ where: { transferPairId: t.pairId } });
        }
      }

      if (pv.balance && typeof pv.balance === "object") {
        const b = pv.balance as { accountId: string; prevBal: number };
        await tx.financialAccount.update({
          where: { id: b.accountId },
          data: { currentBalance: b.prevBal },
        });
      }

      if (pv.creditCard && typeof pv.creditCard === "object") {
        const c = pv.creditCard as { id: string; balance: number };
        const card = await tx.creditCard.findUnique({ where: { id: c.id } });
        if (card) {
          await tx.creditCard.update({ where: { id: c.id }, data: { currentBalance: c.balance } });
          await tx.financialAccount.update({
            where: { id: card.accountId },
            data: { currentBalance: c.balance },
          });
        }
      }

      if (pv.bill && typeof pv.bill === "object") {
        const b = pv.bill as { id: string; nextDueDate?: Date | null };
        await tx.bill.update({
          where: { id: b.id },
          data: { nextDueDate: b.nextDueDate ? new Date(b.nextDueDate) : null },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: "VOICE_FINANCIAL_COMMAND_UNDONE",
          entityType: meta.command.intent,
          metadata: { undoneAuditId: auditId },
        },
      });
    });
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Undo failed",
      updatedEntities: [],
      previousSnapshotId: beforeState.id,
      newSnapshotId: beforeState.id,
      metricChanges: [],
      warnings: [],
    };
  }

  const afterState = await recalculateFinancialState(userId, { reason: "Voice undo" });
  return {
    success: true,
    message: "Voice update undone",
    updatedEntities: [],
    previousSnapshotId: beforeState.id,
    newSnapshotId: afterState.id,
    metricChanges: metricChanges(beforeState, afterState),
    warnings: [],
    auditId,
  };
}
