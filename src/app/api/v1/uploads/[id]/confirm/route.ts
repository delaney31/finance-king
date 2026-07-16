import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { confirmImport } from "@/lib/uploads/confirm-import";
import type { ConfirmImportInput } from "@/lib/uploads/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as Omit<ConfirmImportInput, "documentId">;
  const input: ConfirmImportInput = { ...body, documentId: id };

  try {
    const summary = await confirmImport(session.user.id, input);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("confirm import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 }
    );
  }
}

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
  });
  if (!doc?.importSummary) {
    return NextResponse.json({ error: "No import summary" }, { status: 404 });
  }

  return NextResponse.json(doc.importSummary);
}
