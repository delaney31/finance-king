import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage/provider";
import { isStorageConfigured } from "@/lib/storage/config";

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

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          "File storage is not configured. Add STORAGE_* environment variables (see docs/render.md).",
      },
      { status: 503 }
    );
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
  try {
    const storage = getStorage();
    await storage.upload(storageKey, buffer, file.type || "application/octet-stream");
  } catch (error) {
    console.error("Storage upload failed:", error);
    return NextResponse.json(
      { error: "Failed to save file to storage. Check STORAGE_* credentials and bucket name." },
      { status: 502 }
    );
  }

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

  return NextResponse.json({
    id: doc.id,
    fileName: doc.fileName,
    status: "PENDING",
    institution: null,
    documentType: null,
    createdAt: doc.createdAt.toISOString(),
    processUrl: `/api/v1/uploads/${doc.id}/process`,
  });
}
