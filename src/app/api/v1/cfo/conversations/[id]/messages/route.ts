import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processCFOQuestion } from "@/lib/ai/orchestrator";
import { sendMessageSchema } from "@/lib/ai/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = sendMessageSchema.safeParse({ ...body, conversationId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const result = await processCFOQuestion({
      userId: session.user.id,
      question: parsed.data.question,
      conversationId: id,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process question";
    return NextResponse.json({ error: message }, { status: 429 });
  }
}
