import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().optional(),
  household: z.string().optional(),
  monthlySpendingTarget: z.string().optional(),
  emergencyFundGoal: z.string().optional(),
  taxReserveGoal: z.string().optional(),
  creditScoreGoal: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const userId = session.user.id;

  if (parsed.data.name) {
    await prisma.user.update({ where: { id: userId }, data: { name: parsed.data.name } });
  }

  if (parsed.data.household) {
    await prisma.household.upsert({
      where: { userId },
      create: { userId, name: parsed.data.household },
      update: { name: parsed.data.household },
    });
  }

  if (parsed.data.emergencyFundGoal) {
    await prisma.savingsGoal.upsert({
      where: { id: "onboarding-emergency" },
      create: {
        id: "onboarding-emergency",
        userId,
        type: "EMERGENCY_FUND",
        name: "Emergency Reserve",
        targetAmount: parseFloat(parsed.data.emergencyFundGoal),
        isProtected: true,
      },
      update: { targetAmount: parseFloat(parsed.data.emergencyFundGoal) },
    }).catch(() =>
      prisma.savingsGoal.create({
        data: {
          userId,
          type: "EMERGENCY_FUND",
          name: "Emergency Reserve",
          targetAmount: parseFloat(parsed.data.emergencyFundGoal!),
          isProtected: true,
        },
      })
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingComplete: true },
  });

  return NextResponse.json({ success: true });
}
