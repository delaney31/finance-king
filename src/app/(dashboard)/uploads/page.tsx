import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { UploadsContent } from "@/components/uploads/uploads-content";
import { isStorageConfigured } from "@/lib/storage/config";

export default async function UploadsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [uploads, accounts] = await Promise.all([
    prisma.uploadedDocument.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.financialAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true, nickname: true, institution: true, accountType: true },
      orderBy: { nickname: "asc" },
    }),
  ]);

  return (
    <UploadsContent
      initialUploads={uploads.map((u) => ({
        id: u.id,
        fileName: u.fileName,
        status: u.status,
        institution: u.institution,
        documentType: u.documentType,
        createdAt: u.createdAt.toISOString(),
      }))}
      accounts={accounts}
      storageReady={isStorageConfigured()}
    />
  );
}
