-- CreateEnum
CREATE TYPE "AliasSource" AS ENUM ('SYSTEM', 'USER', 'AI_LEARNED');

-- CreateEnum
CREATE TYPE "AccountActivityEventType" AS ENUM (
  'ACCOUNT_CREATED',
  'BALANCE_UPDATED',
  'TRANSACTION_ADDED',
  'TRANSACTION_UPDATED',
  'TRANSACTION_DELETED',
  'INCOME_RECORDED',
  'EXPENSE_RECORDED',
  'PAYMENT_RECORDED',
  'TRANSFER_SENT',
  'TRANSFER_RECEIVED',
  'BILL_PAID',
  'PENDING_CLEARED',
  'SCREENSHOT_IMPORTED',
  'VOICE_COMMAND_APPLIED',
  'PROTECTED_AMOUNT_CHANGED',
  'MINIMUM_FLOOR_CHANGED',
  'ACCOUNT_DETAILS_CHANGED',
  'IMPORT_UNDONE',
  'CHANGE_UNDONE'
);

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('VOICE', 'AI_CHAT', 'MANUAL', 'SCREENSHOT', 'SYSTEM', 'IMPORT');

-- CreateTable
CREATE TABLE "AccountAlias" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "source" "AliasSource" NOT NULL DEFAULT 'USER',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultCategory" TEXT,
    "defaultAccountId" TEXT,
    "businessEntityId" TEXT,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "eventType" "AccountActivityEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" DATE NOT NULL,
    "previousBalance" DECIMAL(14,2),
    "newBalance" DECIMAL(14,2),
    "amount" DECIMAL(14,2),
    "transactionId" TEXT,
    "relatedAccountId" TEXT,
    "relatedBillId" TEXT,
    "relatedDebtId" TEXT,
    "relatedUploadId" TEXT,
    "payee" TEXT,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "source" "ActivitySource" NOT NULL,
    "originalTranscript" TEXT,
    "financialSnapshotId" TEXT,
    "auditLogId" TEXT NOT NULL,

    CONSTRAINT "AccountActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountAlias_userId_normalizedAlias_idx" ON "AccountAlias"("userId", "normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "AccountAlias_userId_normalizedAlias_financialAccountId_key" ON "AccountAlias"("userId", "normalizedAlias", "financialAccountId");

-- CreateIndex
CREATE INDEX "Payee_userId_idx" ON "Payee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payee_userId_canonicalName_key" ON "Payee"("userId", "canonicalName");

-- CreateIndex
CREATE INDEX "AccountActivityEvent_accountId_timestamp_idx" ON "AccountActivityEvent"("accountId", "timestamp");

-- CreateIndex
CREATE INDEX "AccountActivityEvent_userId_accountId_idx" ON "AccountActivityEvent"("userId", "accountId");

-- AddForeignKey
ALTER TABLE "AccountAlias" ADD CONSTRAINT "AccountAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAlias" ADD CONSTRAINT "AccountAlias_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payee" ADD CONSTRAINT "Payee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountActivityEvent" ADD CONSTRAINT "AccountActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountActivityEvent" ADD CONSTRAINT "AccountActivityEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
