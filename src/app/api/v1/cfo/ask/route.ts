import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import "@/lib/ai/pipeline/startup";
import { processCFOQuestion } from "@/lib/ai/orchestrator";
import { mapPipelineError } from "@/lib/ai/pipeline/error-map";
import { isAbortError } from "@/lib/ai/pipeline/errors";
import { z } from "zod";

export const maxDuration = 60;

const askSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  financialSnapshotId: z.string().optional(),
  idempotencyKey: z.string().min(8).max(128),
  skipAI: z.boolean().optional(),
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          category: "UNAUTHORIZED",
          message: "Please sign in to use Ask My CFO.",
          retryable: false,
        },
      },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          category: "INVALID_JSON",
          message: "Invalid request body.",
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          category: "VALIDATION",
          message: "Invalid input.",
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  const signal = req.signal;

  try {
    const result = await processCFOQuestion({
      userId: session.user.id,
      question: parsed.data.message,
      conversationId: parsed.data.conversationId,
      requestId,
      idempotencyKey: parsed.data.idempotencyKey,
      signal,
      skipAI: parsed.data.skipAI,
    });

    return NextResponse.json({
      success: true,
      requestId: result.requestId ?? requestId,
      source: result.source ?? "AI",
      conversationId: result.conversationId,
      messageId: result.messageId,
      snapshotId: result.snapshotId,
      snapshotStale: result.snapshotStale,
      answer: result.response,
      fallback: result.fallback,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            category: "REQUEST_CANCELLED",
            message: "Request was cancelled.",
            retryable: true,
          },
        },
        { status: 499 }
      );
    }

    const mapped = mapPipelineError(error);

    return NextResponse.json(
      {
        success: false,
        requestId,
        error: mapped,
      },
      { status: mapped.category === "RATE_LIMIT" ? 429 : 500 }
    );
  }
}
