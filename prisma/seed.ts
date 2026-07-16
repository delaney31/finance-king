import { PrismaClient, type IncomeFrequency, type RoutingTag } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addMonths, format } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo12345", 12);

  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.extractionResult.deleteMany();
  await prisma.uploadedDocument.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.plannedPurchase.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.incomeSource.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.creditCard.deleteMany();
  await prisma.savingsGoal.deleteMany();
  await prisma.accountRoutingRule.deleteMany();
  await prisma.accountBalanceSnapshot.deleteMany();
  await prisma.financialAccount.deleteMany();
  await prisma.businessEntity.deleteMany();
  await prisma.householdMember.deleteMany();
  await prisma.household.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: "tim@financeking.local",
      name: "Timothy",
      passwordHash,
      onboardingComplete: true,
      planTier: "KING",
      preference: {
        create: {
          safetyMarginFlat: 500,
          safetyMarginPercent: 0,
          theme: "dark",
        },
      },
      subscription: {
        create: {
          planTier: "KING",
          status: "ACTIVE",
          ocrQuotaMonthly: 100,
          storageQuotaMb: 2000,
        },
      },
      household: {
        create: { name: "Delaney Household" },
      },
    },
  });

  const jadeSystems = await prisma.businessEntity.create({
    data: { userId: user.id, name: "JadeSystems LLC" },
  });
  const pacificLuxe = await prisma.businessEntity.create({
    data: { userId: user.id, name: "Pacific Luxe" },
  });

  const accounts = await Promise.all([
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        institution: "PenFed",
        nickname: "PenFed Personal Checking",
        accountType: "CHECKING",
        routingTag: "PERSONAL",
        currentBalance: 24032.25,
        minimumTargetBalance: 10000,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        institution: "PenFed",
        nickname: "PenFed Premium Online Savings",
        accountType: "SAVINGS",
        routingTag: "EMERGENCY",
        currentBalance: 40000.01,
        protectedBalance: 40000,
        minimumTargetBalance: 40000,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        institution: "Wells Fargo",
        nickname: "Wells Fargo Joint Checking",
        accountType: "JOINT_CHECKING",
        ownershipType: "JOINT",
        routingTag: "NY_PROPERTY",
        currentBalance: 1000,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        institution: "Wells Fargo",
        nickname: "Wells Fargo Joint Savings",
        accountType: "JOINT_SAVINGS",
        ownershipType: "JOINT",
        routingTag: "NY_PROPERTY",
        currentBalance: 0,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        businessEntityId: jadeSystems.id,
        institution: "Truist",
        nickname: "Truist JadeSystems Checking",
        accountType: "BUSINESS_CHECKING",
        designation: "BUSINESS",
        routingTag: "JADESYSTEMS",
        currentBalance: 0,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        businessEntityId: jadeSystems.id,
        institution: "Truist",
        nickname: "Truist Tax Reserve",
        accountType: "TAX_RESERVE",
        designation: "BUSINESS",
        routingTag: "TAX_RESERVE",
        currentBalance: 0,
        minimumTargetBalance: 30000,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        businessEntityId: pacificLuxe.id,
        institution: "Mercury",
        nickname: "Mercury Pacific Luxe Checking",
        accountType: "BUSINESS_CHECKING",
        designation: "BUSINESS",
        routingTag: "PACIFIC_LUXE",
        currentBalance: 0,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        businessEntityId: pacificLuxe.id,
        institution: "Mercury",
        nickname: "Mercury Pacific Luxe Savings",
        accountType: "BUSINESS_SAVINGS",
        designation: "BUSINESS",
        routingTag: "PACIFIC_LUXE",
        currentBalance: 0,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        institution: "Current",
        nickname: "Current Checking",
        accountType: "CHECKING",
        routingTag: "PERSONAL",
        currentBalance: 0,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        institution: "Current",
        nickname: "Current Savings",
        accountType: "SAVINGS",
        routingTag: "PERSONAL",
        currentBalance: 0,
        isLiquid: true,
        isSeedData: true,
      },
    }),
    prisma.financialAccount.create({
      data: {
        userId: user.id,
        institution: "American Express",
        nickname: "Amex",
        accountType: "CREDIT_CARD",
        routingTag: "PERSONAL",
        currentBalance: -30000,
        creditLimit: 35000,
        interestRate: 0.2499,
        minimumPayment: 500,
        paymentDueDay: 15,
        statementCloseDay: 5,
        isLiquid: false,
        isSeedData: true,
      },
    }),
  ]);

  const [
    penfedChecking,
    penfedSavings,
    wellsChecking,
    ,
    truistChecking,
    truistTax,
    mercuryChecking,
    mercurySavings,
  ] = accounts;

  const amexAccount = accounts[10];

  await prisma.creditCard.create({
    data: {
      userId: user.id,
      accountId: amexAccount.id,
      issuer: "American Express",
      currentBalance: 30000,
      creditLimit: 35000,
      apr: 0.2499,
      minimumPayment: 500,
      paymentDueDay: 15,
      statementCloseDay: 5,
      isSeedData: true,
    },
  });

  await prisma.debt.create({
    data: {
      userId: user.id,
      accountId: amexAccount.id,
      name: "Amex",
      currentBalance: 30000,
      interestRate: 0.2499,
      minimumPayment: 500,
      targetPayoffDate: new Date("2025-10-31"),
      isSeedData: true,
    },
  });

  // Routing rules
  await prisma.accountRoutingRule.createMany({
    data: [
      { userId: user.id, name: "W-2 Income → PenFed", incomeSourceKey: "w2", targetAccountId: penfedChecking.id, allocationPercent: 100 },
      { userId: user.id, name: "Contract → Truist", incomeSourceKey: "contract", targetAccountId: truistChecking.id, allocationPercent: 65 },
      { userId: user.id, name: "Contract Tax Reserve", incomeSourceKey: "contract", targetAccountId: truistTax.id, allocationPercent: 35 },
      { userId: user.id, name: "Turo → Mercury", incomeSourceKey: "turo", targetAccountId: mercuryChecking.id, allocationPercent: 100 },
      { userId: user.id, name: "NY Rent → Wells Fargo", incomeSourceKey: "ny_rent", targetAccountId: wellsChecking.id, allocationPercent: 100 },
    ],
  });

  // Goals
  await prisma.savingsGoal.createMany({
    data: [
      { userId: user.id, type: "EMERGENCY_FUND", name: "Emergency Reserve", targetAmount: 40000, currentAmount: 40000.01, accountId: penfedSavings.id, isProtected: true, isSeedData: true },
      { userId: user.id, type: "TAX_RESERVE", name: "Tax Reserve", targetAmount: 30000, currentAmount: 0, accountId: truistTax.id, isSeedData: true },
      { userId: user.id, type: "CUSTOM", name: "Personal Operating Cash", targetAmount: 10000, currentAmount: 24032.25, accountId: penfedChecking.id, isSeedData: true },
    ],
  });

  const today = new Date();
  const year = today.getFullYear();

  // Income before August
  type IncomeEntry = {
    name: string;
    amount: number;
    frequency: IncomeFrequency;
    expectedDate: Date;
    routingTag: RoutingTag;
    isProvisional?: boolean;
  };

  const incomeEntries: IncomeEntry[] = [
    { name: "Existing Contract Payment", amount: 18600, frequency: "ONE_TIME", expectedDate: new Date(year, 6, 15), routingTag: "JADESYSTEMS" },
    { name: "Turo/Pacific Luxe Rental", amount: 5000, frequency: "ONE_TIME", expectedDate: new Date(year, 6, 20), routingTag: "PACIFIC_LUXE" },
    { name: "W-2 Income", amount: 5000, frequency: "ONE_TIME", expectedDate: new Date(year, 6, 25), routingTag: "PERSONAL" },
    { name: "NY Rental Income", amount: 4300, frequency: "ONE_TIME", expectedDate: new Date(year, 6, 1), routingTag: "NY_PROPERTY" },
    { name: "Diminished Value Payment", amount: 4000, frequency: "ONE_TIME", expectedDate: new Date(year, 6, 28), routingTag: "PERSONAL", isProvisional: true },
  ];

  // Monthly income Aug-Oct
  for (let m = 7; m <= 9; m++) {
    incomeEntries.push(
      { name: "Existing Contract", amount: 18600, frequency: "MONTHLY", expectedDate: new Date(year, m, 1), routingTag: "JADESYSTEMS" },
      { name: "New Contract", amount: 18200, frequency: "MONTHLY", expectedDate: new Date(year, m, 15), routingTag: "JADESYSTEMS" },
      { name: "W-2 Income", amount: 10000, frequency: "MONTHLY", expectedDate: new Date(year, m, 1), routingTag: "PERSONAL" },
      { name: "Turo/Pacific Luxe", amount: 5000, frequency: "MONTHLY", expectedDate: new Date(year, m, 10), routingTag: "PACIFIC_LUXE" },
      { name: "NY Rental Income", amount: 4300, frequency: "MONTHLY", expectedDate: new Date(year, m, 5), routingTag: "NY_PROPERTY" },
    );
  }

  // Nov-Dec (no new contract)
  for (let m = 10; m <= 11; m++) {
    incomeEntries.push(
      { name: "Existing Contract", amount: 18600, frequency: "MONTHLY", expectedDate: new Date(year, m, 1), routingTag: "JADESYSTEMS" },
      { name: "W-2 Income", amount: 10000, frequency: "MONTHLY", expectedDate: new Date(year, m, 1), routingTag: "PERSONAL" },
      { name: "Turo/Pacific Luxe", amount: 5000, frequency: "MONTHLY", expectedDate: new Date(year, m, 10), routingTag: "PACIFIC_LUXE" },
      { name: "NY Rental Income", amount: 4300, frequency: "MONTHLY", expectedDate: new Date(year, m, 5), routingTag: "NY_PROPERTY" },
    );
  }

  for (const inc of incomeEntries) {
    await prisma.incomeSource.create({
      data: {
        userId: user.id,
        name: inc.name,
        amount: inc.amount,
        frequency: inc.frequency,
        status: "SCHEDULED",
        expectedDate: inc.expectedDate,
        routingTag: inc.routingTag,
        isProvisional: "isProvisional" in inc ? inc.isProvisional : false,
        isSeedData: true,
      },
    });
  }

  // Bills
  const bills = [
    { name: "NY Mortgage", amount: 8200, dueDay: 1, categorySlug: "housing" },
    { name: "Santa Monica Rent", amount: 5700, dueDay: 1, categorySlug: "housing" },
    { name: "Porsche Turbo S Payment", amount: 5700, dueDay: 15, categorySlug: "vehicle_loans" },
    { name: "Monthly Tax Payment", amount: 900, dueDay: 10, categorySlug: "taxes" },
    { name: "401(k) Repayment", amount: 600, dueDay: 20, categorySlug: "retirement" },
    { name: "General Living Expenses", amount: 6000, dueDay: 1, categorySlug: "food" },
  ];

  for (const bill of bills) {
    await prisma.bill.create({
      data: {
        userId: user.id,
        name: bill.name,
        amount: bill.amount,
        frequency: "MONTHLY",
        dueDay: bill.dueDay,
        nextDueDate: new Date(year, today.getMonth(), bill.dueDay),
        categorySlug: bill.categorySlug,
        isRequired: true,
        isSeedData: true,
      },
    });
  }

  // Amex payment plan
  const amexPayments = [
    { date: new Date(year, 6, 25), amount: 15000 },
    { date: new Date(year, 7, 15), amount: 5000 },
    { date: new Date(year, 8, 15), amount: 5000 },
    { date: new Date(year, 9, 15), amount: 5000 },
  ];

  for (const p of amexPayments) {
    await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title: `Amex Payment $${p.amount.toLocaleString()}`,
        type: "DEBT_PAYMENT",
        date: p.date,
        amount: p.amount,
        accountId: penfedChecking.id,
        isSeedData: true,
      },
    });
  }

  // Planned purchases
  const purchases = [
    { name: "Monterey Car Week", maxAmount: 2500, plannedDate: new Date(year, 7, 15) },
    { name: "LaGrange Family Road Trip", maxAmount: 6500, plannedDate: new Date(year, 8, 1) },
    { name: "Carrera S Wrap", maxAmount: 6000, plannedDate: new Date(year, 10, 1) },
    { name: "Disneyland Day with Daughter", maxAmount: 700, targetAmount: 600, plannedDate: new Date(year, 8, 15) },
    { name: "Pacific Luxe Advertising Test", maxAmount: 500, plannedDate: new Date(year, 7, 1), isBusiness: true, accountId: mercuryChecking.id },
  ];

  for (const p of purchases) {
    await prisma.plannedPurchase.create({
      data: {
        userId: user.id,
        name: p.name,
        maxAmount: p.maxAmount,
        targetAmount: "targetAmount" in p ? p.targetAmount : null,
        plannedDate: p.plannedDate,
        isBusiness: p.isBusiness ?? false,
        accountId: p.accountId ?? penfedChecking.id,
        isCommitted: true,
        isSeedData: true,
      },
    });
  }

  // Recurring transactions
  await prisma.recurringTransaction.createMany({
    data: [
      { userId: user.id, name: "NY Mortgage", typicalAmount: 8200, frequency: "MONTHLY", confidence: 0.99, classification: "NECESSARY", status: "APPROVED", isSeedData: true },
      { userId: user.id, name: "Santa Monica Rent", typicalAmount: 5700, frequency: "MONTHLY", confidence: 0.99, classification: "NECESSARY", status: "APPROVED", isSeedData: true },
      { userId: user.id, name: "Porsche Payment", typicalAmount: 5700, frequency: "MONTHLY", confidence: 0.99, classification: "NECESSARY", status: "APPROVED", isSeedData: true },
      { userId: user.id, name: "Contract Income", typicalAmount: 18600, frequency: "MONTHLY", confidence: 0.95, classification: "NECESSARY", status: "APPROVED", isSeedData: true },
    ],
  });

  // Scenarios
  await prisma.scenario.createMany({
    data: [
      { userId: user.id, type: "CONSERVATIVE", name: "Conservative", parameters: { incomeMultiplier: 0.9, expenseMultiplier: 1.1, includeEsop: false } },
      { userId: user.id, type: "BASE", name: "Base", parameters: { incomeMultiplier: 1.0, expenseMultiplier: 1.0, includeEsop: false } },
      { userId: user.id, type: "STRONG", name: "Strong", parameters: { incomeMultiplier: 1.0, expenseMultiplier: 1.0, includeEsop: true, esopAmount: 105000 } },
    ],
  });

  // Sample alert
  await prisma.alert.create({
    data: {
      userId: user.id,
      type: "UPCOMING_BILL",
      severity: "WARNING",
      title: "Amex Payment Due",
      message: "$15,000 Amex payment scheduled before August 1. Ensure PenFed checking is funded.",
    },
  });

  await prisma.recommendation.create({
    data: {
      userId: user.id,
      title: "Fund Amex Payoff",
      message: "Schedule $15,000 transfer to PenFed checking before July 25 Amex payment.",
      priority: 1,
      actionUrl: "/credit",
    },
  });

  console.log("Seed complete. Login: tim@financeking.local / demo12345");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
