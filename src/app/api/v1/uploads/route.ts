import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage/provider";
import { enqueueDocumentProcessing } from "@/lib/jobs/queue";
import { processDocument } from "@/workers/process-upload";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/heic",
  "application/pdf",
  "text/csv",
];

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith(".csv")) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  const duplicate = await prisma.uploadedDocument.findUnique({
    where: { userId_fileHash: { userId: session.user.id, fileHash } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Duplicate upload", id: duplicate.id }, { status: 409 });
  }

  const storageKey = `${session.user.id}/${randomUUID()}-${file.name}`;
  const storage = getStorage();
  await storage.upload(storageKey, buffer, file.type || "application/octet-stream");

  const doc = await prisma.uploadedDocument.create({
    data: {
      userId: session.user.id,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      fileHash,
      storageKey,
      status: "PENDING",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DOCUMENT_UPLOADED",
      entityType: "UploadedDocument",
      entityId: doc.id,
      metadata: { fileName: file.name, fileSize: file.size },
    },
  });

  try {
    await enqueueDocumentProcessing(doc.id);
  } catch {
    await processDocument(doc.id);
  }

  return NextResponse.json({
    id: doc.id,
    fileName: doc.fileName,
    status: "PROCESSING",
    institution: null,
    createdAt: doc.createdAt.toISOString(),
  });
}
