import { auth } from "@/lib/auth";
import { getOrRecalculateFinancialState } from "@/lib/financial-state/recalculate";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getOrRecalculateFinancialState(session.user.id, {
    reason: "api-financial-state",
  });

  return NextResponse.json(state);
}
