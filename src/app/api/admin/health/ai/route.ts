import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createAIProvider } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      status: "skipped",
      message: "OpenAI not configured",
    });
  }

  const provider = createAIProvider();
  const started = Date.now();

  try {
    const result = await provider.classifyIntent({
      question: "How much can I safely spend today?",
    });
    return NextResponse.json({
      status: "ok",
      intent: result.intent,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "AI test failed",
        durationMs: Date.now() - started,
      },
      { status: 503 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to trigger a small AI classification test (authenticated).",
  });
}
