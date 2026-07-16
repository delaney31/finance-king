export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_ACCESS_KEY &&
      process.env.STORAGE_SECRET_KEY &&
      process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_BUCKET
  );
}

export function getStorageConfigSummary() {
  return {
    configured: isStorageConfigured(),
    endpoint: process.env.STORAGE_ENDPOINT ?? null,
    bucket: process.env.STORAGE_BUCKET ?? null,
    region: process.env.STORAGE_REGION ?? "us-east-1",
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  };
}
