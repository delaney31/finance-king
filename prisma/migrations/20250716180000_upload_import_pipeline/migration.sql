-- Upload import pipeline

CREATE TYPE "TransactionClearanceStatus" AS ENUM ('CLEARED', 'PENDING', 'PROJECTED', 'CANCELLED');

ALTER TABLE "FinancialAccount"
  ADD COLUMN IF NOT EXISTS "availableBalance" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "pendingBalance" DECIMAL(14,2);

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "clearanceStatus" "TransactionClearanceStatus" NOT NULL DEFAULT 'CLEARED',
  ADD COLUMN IF NOT EXISTS "transactionFingerprint" TEXT;

ALTER TABLE "UploadedDocument"
  ADD COLUMN IF NOT EXISTS "matchedAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "importSummary" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "undoPayload" JSONB;

ALTER TABLE "ExtractionResult"
  ADD COLUMN IF NOT EXISTS "documentClassification" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "accountMatchResult" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "FinancialStateSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "asOfDate" DATE NOT NULL,
  "payload" JSONB NOT NULL,
  "safeToSpendToday" DECIMAL(14,2) NOT NULL,
  "monthEndBuffer" DECIMAL(14,2) NOT NULL,
  "creditUtilization" DECIMAL(8,4) NOT NULL,
  "totalLiquidCash" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialStateSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionFingerprint" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "transactionId" TEXT,
  "documentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionFingerprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionFingerprint_userId_fingerprint_key" ON "TransactionFingerprint"("userId", "fingerprint");
CREATE INDEX "TransactionFingerprint_accountId_idx" ON "TransactionFingerprint"("accountId");
CREATE INDEX "FinancialStateSnapshot_userId_createdAt_idx" ON "FinancialStateSnapshot"("userId", "createdAt");

ALTER TABLE "FinancialStateSnapshot" ADD CONSTRAINT "FinancialStateSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionFingerprint" ADD CONSTRAINT "TransactionFingerprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
