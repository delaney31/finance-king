import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSuggestedQuestions } from "@/lib/ai/suggested-questions";

const DEMO_EMAIL = "tim@financeking.local";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isDemo = session.user.email === DEMO_EMAIL;
  return NextResponse.json({ questions: getSuggestedQuestions(isDemo) });
}
