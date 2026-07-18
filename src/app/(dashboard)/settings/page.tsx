import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountAliasesSettings } from "@/components/settings/account-aliases-settings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { preference: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Email: {user?.email}</p>
          <p>Name: {user?.name}</p>
          <p>Plan: {user?.planTier}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Safety margin: ${Number(user?.preference?.safetyMarginFlat ?? 500)}</p>
          <p>Local OCR only: {user?.preference?.localOcrOnly ? "Yes" : "No"}</p>
          <p>Theme: {user?.preference?.theme}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ask My CFO</CardTitle></CardHeader>
        <CardContent>
          <AccountAliasesSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form action="/api/v1/export" method="GET">
            <Button type="submit" variant="outline">Export my data</Button>
          </form>
          <p className="text-xs text-fk-muted">
            Finance King never sells your financial information. See our privacy policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
