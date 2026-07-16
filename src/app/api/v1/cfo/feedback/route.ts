import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { submitFeedback } from "@/lib/ai/orchestrator";
import { feedbackSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await submitFeedback(
      session.user.id,
      parsed.data.messageId,
      parsed.data.feedback,
      parsed.data.note
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
}
