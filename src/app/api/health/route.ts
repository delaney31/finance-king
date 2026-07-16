import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createRedisConnection } from "@/lib/redis";
import { getStorage } from "@/lib/storage/provider";
import { isStorageConfigured } from "@/lib/storage/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = { app: "ok" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redis = createRedisConnection();
    try {
      await redis.connect();
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    } finally {
      redis.disconnect();
    }
  } else {
    checks.redis = "not_configured";
  }

  if (isStorageConfigured()) {
    try {
      const storage = getStorage();
      const testKey = `_healthcheck/${Date.now()}.txt`;
      await storage.upload(testKey, Buffer.from("ok"), "text/plain");
      await storage.delete(testKey);
      checks.storage = "ok";
    } catch {
      checks.storage = "error";
    }
  } else {
    checks.storage = "not_configured";
  }

  const healthy = checks.database === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks },
    // Always 200 so Render liveness checks pass; use body for dependency status.
    { status: 200 }
  );
}
