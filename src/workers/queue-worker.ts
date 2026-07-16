import { Worker } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { processDocument } from "./process-upload";

const worker = new Worker(
  "process-document",
  async (job) => {
    const { documentId } = job.data as { documentId: string };
    await processDocument(documentId);
  },
  { connection: createRedisConnection() }
);

worker.on("completed", (job) => {
  console.log(`Processed document ${job.data.documentId}`);
});

worker.on("failed", (job, err) => {
  console.error(`Failed document ${job?.data?.documentId}:`, err);
});

console.log("Finance King upload worker started");
