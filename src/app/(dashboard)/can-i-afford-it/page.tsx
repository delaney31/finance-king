import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { AffordContent } from "@/components/afford/afford-content";

export default async function AffordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const snapshot = await getEngineSnapshot(session.user.id);

  return <AffordContent accounts={snapshot.accounts.map((a) => ({ id: a.id, nickname: a.nickname }))} />;
}
