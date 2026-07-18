import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payees = await prisma.payee.findMany({
    where: { userId: session.user.id },
    orderBy: { transactionCount: "desc" },
  });

  return NextResponse.json({ payees });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.canonicalName) {
    return NextResponse.json({ error: "canonicalName required" }, { status: 400 });
  }

  const payee = await prisma.payee.upsert({
    where: {
      userId_canonicalName: {
        userId: session.user.id,
        canonicalName: body.canonicalName.trim(),
      },
    },
    create: {
      userId: session.user.id,
      canonicalName: body.canonicalName.trim(),
      aliases: body.aliases ?? [],
      defaultCategory: body.defaultCategory,
      defaultAccountId: body.defaultAccountId,
    },
    update: {
      aliases: body.aliases,
      defaultCategory: body.defaultCategory,
      defaultAccountId: body.defaultAccountId,
    },
  });

  return NextResponse.json({ payee });
}
