import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { simulatePurchaseImpact } from "@/lib/engine";

const schema = z.object({
  name: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  accountId: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const snapshot = await getEngineSnapshot(session.user.id);
  const impact = simulatePurchaseImpact(snapshot, parsed.data);

  return NextResponse.json(impact);
}
