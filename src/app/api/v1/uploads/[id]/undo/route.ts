import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { undoImport } from "@/lib/uploads/confirm-import";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await undoImport(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Undo failed" },
      { status: 400 }
    );
  }
}
