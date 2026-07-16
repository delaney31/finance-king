import { auth } from "@/lib/auth";
import { applyCFODataCommand } from "@/lib/ai/commands/apply";
import { cfoDataCommandSchema } from "@/lib/ai/commands/schemas";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = cfoDataCommandSchema.safeParse(body.command);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid command", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await applyCFODataCommand(session.user.id, parsed.data, {
    originalMessage: body.originalMessage,
    provider: body.provider ?? "rules",
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
