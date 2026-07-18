import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ensureSystemAliases,
  createUserAlias,
  deleteAlias,
  loadAliases,
} from "@/lib/accounts/alias-service";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSystemAliases(session.user.id);
  const aliases = await loadAliases(session.user.id);
  const accounts = await prisma.financialAccount.findMany({
    where: { userId: session.user.id },
    select: { id: true, nickname: true, institution: true },
  });

  return NextResponse.json({ aliases, accounts });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { alias, financialAccountId } = await req.json();
  if (!alias || !financialAccountId) {
    return NextResponse.json({ error: "alias and financialAccountId required" }, { status: 400 });
  }

  const created = await createUserAlias(session.user.id, alias, financialAccountId);
  return NextResponse.json({ alias: created });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await deleteAlias(session.user.id, id);
  return NextResponse.json({ ok: true });
}
