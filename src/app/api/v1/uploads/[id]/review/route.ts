import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildImportReview } from "@/lib/uploads/confirm-import";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const review = await buildImportReview(id, session.user.id);
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(review);
}
