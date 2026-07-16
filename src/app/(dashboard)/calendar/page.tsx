import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { projectDailyBalances } from "@/lib/engine";
import { CalendarContent } from "@/components/calendar/calendar-content";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const snapshot = await getEngineSnapshot(session.user.id);
  const projections = projectDailyBalances(snapshot, 30);

  return (
    <CalendarContent
      projections={projections}
      accounts={snapshot.accounts.map((a) => ({ id: a.id, nickname: a.nickname }))}
    />
  );
}
