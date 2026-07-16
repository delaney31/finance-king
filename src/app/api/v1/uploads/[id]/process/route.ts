import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { processDocument } from "@/workers/process-upload";

export const maxDuration = 60;

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
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await processDocument(id);
    const updated = await prisma.uploadedDocument.findFirst({
      where: { id, userId: session.user.id },
    });
    return NextResponse.json({
      success: true,
      status: updated?.status ?? "REVIEW_REQUIRED",
      institution: updated?.institution ?? null,
      documentType: updated?.documentType ?? null,
    });
  } catch (error) {
    console.error("Reprocess failed:", error);
    const updated = await prisma.uploadedDocument.findFirst({
      where: { id, userId: session.user.id },
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Processing failed",
        status: updated?.status ?? "REVIEW_REQUIRED",
        institution: updated?.institution ?? null,
        documentType: updated?.documentType ?? null,
      },
      { status: 500 }
    );
  }
}
