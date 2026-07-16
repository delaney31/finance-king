import { prisma } from "@/lib/db";
import { recalculateFinancialState, getLatestFinancialState } from "@/lib/financial-state/recalculate";
import type { FinancialStateSnapshot } from "@/lib/financial-state/types";
import type { CFODataCommand, CFOUpdateResult } from "./schemas";
import { cfoDataCommandSchema } from "./schemas";

function metricChanges(
  before: FinancialStateSnapshot,
  after: FinancialStateSnapshot
): CFOUpdateResult["metricChanges"] {
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

export async function applyCFODataCommand(
  userId: string,
  command: CFODataCommand,
  meta?: { originalMessage?: string; provider?: string }
): Promise<CFOUpdateResult> {
  const parsed = cfoDataCommandSchema.safeParse(command);
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
    (await recalculateFinancialState(userId, { reason: "pre-mutation baseline" }));

  const updatedEntities: CFOUpdateResult["updatedEntities"] = [];
  const previousValues: Record<string, unknown> = {};

  try {
    await prisma.$transaction(async (tx) => {
      switch (cmd.intent) {
        case "UPDATE_ACCOUNT_BALANCE": {
          if (!cmd.accountId || cmd.amount == null) throw new Error("Account and amount required");
          const account = await tx.financialAccount.findFirst({
            where: { id: cmd.accountId, userId },
          });
          if (!account) throw new Error("Account not found");
          previousValues.account = {
            id: account.id,
            currentBalance: account.currentBalance,
          };
          await tx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: cmd.amount },
          });
          await tx.accountBalanceSnapshot.create({
            data: {
              accountId: account.id,
              balance: cmd.amount,
              asOfDate: new Date(),
              source: "MANUAL",
              notes: "CFO update",
            },
          });
          updatedEntities.push({
            type: "account",
            id: account.id,
            label: account.nickname,
          });
          break;
        }

        case "UPDATE_PROTECTED_AMOUNT": {
          if (!cmd.accountId || cmd.protectedAmount == null) throw new Error("Account and amount required");
          const account = await tx.financialAccount.findFirst({
            where: { id: cmd.accountId, userId },
          });
          if (!account) throw new Error("Account not found");
          previousValues.account = {
            id: account.id,
            protectedBalance: account.protectedBalance,
          };
          await tx.financialAccount.update({
            where: { id: account.id },
            data: { protectedBalance: cmd.protectedAmount },
          });
          updatedEntities.push({
            type: "account",
            id: account.id,
            label: `${account.nickname} protected amount`,
          });
          break;
        }

        case "TRANSFER_BETWEEN_ACCOUNTS": {
          if (!cmd.sourceAccountId || !cmd.destinationAccountId || cmd.amount == null) {
            throw new Error("Transfer requires source, destination, and amount");
          }
          const [source, dest] = await Promise.all([
            tx.financialAccount.findFirst({ where: { id: cmd.sourceAccountId, userId } }),
            tx.financialAccount.findFirst({ where: { id: cmd.destinationAccountId, userId } }),
          ]);
          if (!source || !dest) throw new Error("Transfer accounts not found");

          previousValues.transfer = {
            sourceId: source.id,
            sourceBalance: source.currentBalance,
            destId: dest.id,
            destBalance: dest.currentBalance,
          };

          await tx.financialAccount.update({
            where: { id: source.id },
            data: { currentBalance: Number(source.currentBalance) - cmd.amount },
          });
          await tx.financialAccount.update({
            where: { id: dest.id },
            data: { currentBalance: Number(dest.currentBalance) + cmd.amount },
          });

          const pairId = `xfer-${Date.now()}`;
          await tx.transaction.createMany({
            data: [
              {
                userId,
                accountId: source.id,
                amount: -cmd.amount,
                date: new Date(),
                description: `Transfer to ${dest.nickname}`,
                type: "EXPENSE",
                isTransfer: true,
                transferPairId: pairId,
                clearanceStatus: "CLEARED",
              },
              {
                userId,
                accountId: dest.id,
                amount: cmd.amount,
                date: new Date(),
                description: `Transfer from ${source.nickname}`,
                type: "INCOME",
                isTransfer: true,
                transferPairId: pairId,
                clearanceStatus: "CLEARED",
              },
            ],
          });

          updatedEntities.push(
            { type: "transfer", id: pairId, label: `${source.nickname} → ${dest.nickname}` }
          );
          break;
        }

        case "MARK_INCOME_RECEIVED": {
          if (!cmd.accountId || cmd.amount == null) throw new Error("Account and amount required");
          const account = await tx.financialAccount.findFirst({
            where: { id: cmd.accountId, userId },
          });
          if (!account) throw new Error("Account not found");

          const income = cmd.incomeName
            ? await tx.incomeSource.findFirst({
                where: { userId, name: { contains: cmd.incomeName, mode: "insensitive" } },
              })
            : null;

          previousValues.income = income
            ? { id: income.id, status: income.status, receivedDate: income.receivedDate }
            : undefined;
          previousValues.account = {
            id: account.id,
            currentBalance: account.currentBalance,
          };

          if (income) {
            await tx.incomeSource.update({
              where: { id: income.id },
              data: { status: "RECEIVED", receivedDate: new Date() },
            });
            updatedEntities.push({ type: "income", id: income.id, label: income.name });
          }

          await tx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: Number(account.currentBalance) + cmd.amount },
          });
          await tx.transaction.create({
            data: {
              userId,
              accountId: account.id,
              amount: cmd.amount,
              date: new Date(cmd.transactionDate ?? new Date()),
              description: cmd.incomeName ?? "Income deposit",
              type: "INCOME",
              clearanceStatus: "CLEARED",
            },
          });
          updatedEntities.push({ type: "account", id: account.id, label: account.nickname });
          break;
        }

        case "MARK_BILL_PAID": {
          const bill = cmd.billId
            ? await tx.bill.findFirst({ where: { id: cmd.billId, userId } })
            : await tx.bill.findFirst({
                where: {
                  userId,
                  name: { contains: cmd.billName ?? "mortgage", mode: "insensitive" },
                },
              });
          if (!bill) throw new Error("Bill not found");
          previousValues.bill = {
            id: bill.id,
            nextDueDate: bill.nextDueDate,
          };
          const nextMonth = bill.nextDueDate ? new Date(bill.nextDueDate) : new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          await tx.bill.update({
            where: { id: bill.id },
            data: { nextDueDate: nextMonth },
          });
          updatedEntities.push({ type: "bill", id: bill.id, label: bill.name });
          break;
        }

        case "UPDATE_BILL": {
          const bill = await tx.bill.findFirst({
            where: {
              userId,
              name: { contains: cmd.billName ?? "", mode: "insensitive" },
            },
          });
          if (!bill || !cmd.dueDate) throw new Error("Bill or due date not found");
          previousValues.bill = { id: bill.id, nextDueDate: bill.nextDueDate };
          await tx.bill.update({
            where: { id: bill.id },
            data: { nextDueDate: new Date(cmd.dueDate) },
          });
          updatedEntities.push({ type: "bill", id: bill.id, label: bill.name });
          break;
        }

        case "UPDATE_INCOME_DATE": {
          const income = await tx.incomeSource.findFirst({
            where: {
              userId,
              name: { contains: cmd.incomeName ?? "", mode: "insensitive" },
            },
          });
          if (!income || !cmd.dueDate) throw new Error("Income or date not found");
          previousValues.income = { id: income.id, expectedDate: income.expectedDate };
          await tx.incomeSource.update({
            where: { id: income.id },
            data: { expectedDate: new Date(cmd.dueDate) },
          });
          updatedEntities.push({ type: "income", id: income.id, label: income.name });
          break;
        }

        default:
          throw new Error(`Intent ${cmd.intent} not yet implemented`);
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: "CFO_DATA_COMMAND_APPLIED",
          entityType: cmd.intent,
          entityId: updatedEntities[0]?.id,
          metadata: {
            command: cmd,
            previousValues: previousValues as object,
            originalMessage: meta?.originalMessage,
            provider: meta?.provider ?? "rules",
            confirmedAt: new Date().toISOString(),
            previousSnapshotId: beforeState.id,
          },
        },
      });
    });
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
    reason: `CFO command: ${cmd.intent}`,
    sourceEventId: updatedEntities.map((e) => e.id).join(","),
  });

  const audit = await prisma.auditLog.findFirst({
    where: { userId, action: "CFO_DATA_COMMAND_APPLIED" },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    message: cmd.summary,
    updatedEntities,
    previousSnapshotId: beforeState.id,
    newSnapshotId: afterState.id,
    metricChanges: metricChanges(beforeState, afterState),
    warnings: cmd.warnings,
    auditId: audit?.id,
  };
}

export async function undoCFODataCommand(
  userId: string,
  auditId: string
): Promise<CFOUpdateResult> {
  const audit = await prisma.auditLog.findFirst({
    where: { id: auditId, userId, action: "CFO_DATA_COMMAND_APPLIED" },
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
    command: CFODataCommand;
    previousValues: Record<string, unknown>;
    previousSnapshotId?: string;
  };

  const beforeState =
    (await getLatestFinancialState(userId)) ??
    (await recalculateFinancialState(userId));

  try {
    await prisma.$transaction(async (tx) => {
      const pv = meta.previousValues;
      if (pv.account && typeof pv.account === "object" && pv.account !== null) {
        const a = pv.account as { id: string; currentBalance?: unknown; protectedBalance?: unknown };
        const data: Record<string, unknown> = {};
        if (a.currentBalance != null) data.currentBalance = a.currentBalance;
        if (a.protectedBalance != null) data.protectedBalance = a.protectedBalance;
        await tx.financialAccount.update({ where: { id: a.id }, data });
      }
      if (pv.bill && typeof pv.bill === "object" && pv.bill !== null) {
        const b = pv.bill as { id: string; nextDueDate?: string | Date | null };
        await tx.bill.update({
          where: { id: b.id },
          data: { nextDueDate: b.nextDueDate ? new Date(b.nextDueDate) : null },
        });
      }
      if (pv.income && typeof pv.income === "object" && pv.income !== null) {
        const i = pv.income as { id: string; status?: string; receivedDate?: Date | null; expectedDate?: Date | null };
        await tx.incomeSource.update({
          where: { id: i.id },
          data: {
            ...(i.status ? { status: i.status as "SCHEDULED" | "RECEIVED" | "CANCELLED" } : {}),
            ...(i.receivedDate !== undefined ? { receivedDate: i.receivedDate } : {}),
            ...(i.expectedDate !== undefined ? { expectedDate: i.expectedDate } : {}),
          },
        });
      }
      if (pv.transfer && typeof pv.transfer === "object" && pv.transfer !== null) {
        const t = pv.transfer as {
          sourceId: string;
          sourceBalance: unknown;
          destId: string;
          destBalance: unknown;
        };
        await tx.financialAccount.update({
          where: { id: t.sourceId },
          data: { currentBalance: t.sourceBalance as number },
        });
        await tx.financialAccount.update({
          where: { id: t.destId },
          data: { currentBalance: t.destBalance as number },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: "CFO_DATA_COMMAND_UNDONE",
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

  const afterState = await recalculateFinancialState(userId, { reason: "CFO undo" });

  return {
    success: true,
    message: "Change undone",
    updatedEntities: [],
    previousSnapshotId: beforeState.id,
    newSnapshotId: afterState.id,
    metricChanges: metricChanges(beforeState, afterState),
    warnings: [],
    auditId,
  };
}
