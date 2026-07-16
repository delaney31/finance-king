import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.uploadedDocument.findFirst({
    where: { id, userId: session.user.id },
    include: { extractionResult: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const extracted = doc.extractionResult?.extractedData as {
    balance?: { value: string };
    institution?: string;
  } | null;

  if (extracted?.balance?.value) {
    const account = await prisma.financialAccount.findFirst({
      where: {
        userId: session.user.id,
        institution: extracted.institution ?? doc.institution ?? undefined,
      },
    });

    if (account) {
      await prisma.accountBalanceSnapshot.create({
        data: {
          accountId: account.id,
          balance: parseFloat(extracted.balance.value),
          asOfDate: new Date(),
          source: "OCR",
        },
      });
      await prisma.financialAccount.update({
        where: { id: account.id },
        data: { currentBalance: parseFloat(extracted.balance.value) },
      });
    }
  }

  await prisma.uploadedDocument.update({
    where: { id },
    data: { status: "CONFIRMED" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DOCUMENT_CONFIRMED",
      entityType: "UploadedDocument",
      entityId: id,
    },
  });

  return NextResponse.json({ success: true });
}
