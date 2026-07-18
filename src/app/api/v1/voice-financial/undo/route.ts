import { auth } from "@/lib/auth";
import { undoVoiceFinancialCommand } from "@/lib/voice-financial/apply";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.auditId) {
    return NextResponse.json({ error: "auditId required" }, { status: 400 });
  }

  const result = await undoVoiceFinancialCommand(session.user.id, body.auditId);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
