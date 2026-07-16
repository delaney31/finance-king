import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processDocument } from "./process-upload";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "process-document",
  async (job) => {
    const { documentId } = job.data as { documentId: string };
    await processDocument(documentId);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Processed document ${job.data.documentId}`);
});

worker.on("failed", (job, err) => {
  console.error(`Failed document ${job?.data?.documentId}:`, err);
});

console.log("Finance King upload worker started");
