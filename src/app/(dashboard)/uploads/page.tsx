import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { UploadsContent } from "@/components/uploads/uploads-content";

export default async function UploadsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const uploads = await prisma.uploadedDocument.findMany({
    where: { userId: session.user.id },
    include: { extractionResult: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <UploadsContent
      initialUploads={uploads.map((u) => ({
        id: u.id,
        fileName: u.fileName,
        status: u.status,
        institution: u.institution,
        createdAt: u.createdAt.toISOString(),
        extractionResult: u.extractionResult
          ? {
              extractedData: u.extractionResult.extractedData as Record<string, unknown>,
              fieldConfidence: u.extractionResult.fieldConfidence as Record<string, number>,
            }
          : null,
      }))}
    />
  );
}
