import { NextResponse } from "next/server";
import { getStorageConfigSummary } from "@/lib/storage/config";

export async function GET() {
  const summary = getStorageConfigSummary();
  return NextResponse.json({
    ready: summary.configured,
    ...summary,
  });
}
