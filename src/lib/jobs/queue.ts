import { Queue } from "bullmq";
import IORedis from "ioredis";

let queue: Queue | null = null;

function getConnection() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function getUploadQueue(): Queue {
  if (!queue) {
    queue = new Queue("process-document", {
      connection: getConnection(),
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
