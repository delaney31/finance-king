import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
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

  return NextResponse.json({
    id: doc.id,
    fileName: doc.fileName,
    status: doc.status,
    institution: doc.institution,
    createdAt: doc.createdAt.toISOString(),
    extractionResult: doc.extractionResult
      ? {
          extractedData: doc.extractionResult.extractedData as Record<string, unknown>,
          fieldConfidence: doc.extractionResult.fieldConfidence as Record<string, number>,
        }
      : null,
  });
}
