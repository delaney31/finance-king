import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildDashboardSnapshot } from "@/lib/engine";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.onboardingComplete) redirect("/onboarding");

  const engineSnapshot = await getEngineSnapshot(session.user.id);
  const dashboard = buildDashboardSnapshot(engineSnapshot);

  const [alerts, uploads, bills, recommendation] = await Promise.all([
    prisma.alert.findMany({ where: { userId: session.user.id, isRead: false }, take: 5, orderBy: { createdAt: "desc" } }),
    prisma.uploadedDocument.findMany({ where: { userId: session.user.id, status: "REVIEW_REQUIRED" }, take: 3 }),
    prisma.bill.findMany({ where: { userId: session.user.id }, orderBy: { nextDueDate: "asc" }, take: 5 }),
    prisma.recommendation.findFirst({ where: { userId: session.user.id, isDismissed: false }, orderBy: { priority: "asc" } }),
  ]);

  return (
    <DashboardContent
      dashboard={dashboard}
      alerts={alerts.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        severity: a.severity,
      }))}
      pendingUploads={uploads.length}
      upcomingBills={bills.map((b) => ({
        id: b.id,
        name: b.name,
        amount: Number(b.amount),
      }))}
      recommendation={
        recommendation
          ? {
              title: recommendation.title,
              message: recommendation.message,
              actionUrl: recommendation.actionUrl,
            }
          : null
      }
      accounts={engineSnapshot.accounts}
    />
  );
}
