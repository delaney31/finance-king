import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import IORedis from "ioredis";

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
    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
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

  const healthy = checks.database === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503 }
  );
}
