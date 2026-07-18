import { auth } from "@/lib/auth";
import { applyVoiceFinancialCommand } from "@/lib/voice-financial/apply";
import { voiceFinancialCommandSchema } from "@/lib/voice-financial/schemas";
import { learnAlias } from "@/lib/accounts/alias-service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = voiceFinancialCommandSchema.safeParse(body.command);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid command", details: parsed.error.errors }, { status: 400 });
  }

  if (body.learnAlias && body.accountPhrase && body.selectedAccountId) {
    await learnAlias(session.user.id, body.accountPhrase, body.selectedAccountId);
  }

  const result = await applyVoiceFinancialCommand(session.user.id, parsed.data, {
    requestId: body.requestId,
    deviceInfo: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
