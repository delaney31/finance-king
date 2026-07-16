import { getStorage } from "@/lib/storage/provider";
import { getStorageConfigSummary, isStorageConfigured } from "@/lib/storage/config";

async function main() {
  const summary = getStorageConfigSummary();
  console.log("Storage config:", summary);

  if (!isStorageConfigured()) {
    console.error("STORAGE_* environment variables are not fully set.");
    process.exit(1);
  }

  const storage = getStorage();
  const testKey = `_healthcheck/${Date.now()}.txt`;

  await storage.upload(testKey, Buffer.from("finance-king storage ok"), "text/plain");
  console.log("Upload OK:", testKey);

  const downloaded = await storage.download(testKey);
  console.log("Download OK:", downloaded.toString());

  await storage.delete(testKey);
  console.log("Delete OK");

  console.log("Storage is working.");
}

main().catch((error) => {
  console.error("Storage test failed:", error);
  process.exit(1);
});
