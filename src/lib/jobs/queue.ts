import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

let queue: Queue | null = null;

export function getUploadQueue(): Queue {
  if (!queue) {
    queue = new Queue("process-document", {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }
  return queue;
}

export async function enqueueDocumentProcessing(documentId: string) {
  const q = getUploadQueue();
  await q.add("process", { documentId });
}
