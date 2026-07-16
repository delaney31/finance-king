import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listConversations, processCFOQuestion } from "@/lib/ai/orchestrator";
import { sendMessageSchema } from "@/lib/ai/schemas";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listConversations(session.user.id);
  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      lastMessage: c.messages[0]?.content?.slice(0, 120),
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const result = await processCFOQuestion({
      userId: session.user.id,
      question: parsed.data.question,
      conversationId: parsed.data.conversationId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process question";
    return NextResponse.json({ error: message }, { status: 429 });
  }
}
