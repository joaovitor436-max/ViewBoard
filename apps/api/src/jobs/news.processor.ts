import type { Job } from "bullmq";
import IORedis from "ioredis";
import { createWorker, createQueue, QUEUE_NAMES } from "../lib/bullmq.js";
import { getTopHeadlines } from "../modules/integrations/news.service.js";

export interface NewsJobData {
  country?: string;
  category?: string;
  q?: string;
  pageSize?: number;
}

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const newsQueue = createQueue<NewsJobData>(QUEUE_NAMES.NEWS);

export function startNewsWorker() {
  return createWorker<NewsJobData>(
    QUEUE_NAMES.NEWS,
    async (job: Job<NewsJobData>) => {
      const { country, category, q, pageSize } = job.data;
      await getTopHeadlines(redis, { country, category, q, pageSize });
    },
    { concurrency: 2 }
  );
}

export async function scheduleNewsRefresh(
  options: NewsJobData = {}
): Promise<void> {
  const jobId = `news:${options.country ?? "br"}:${options.category ?? ""}`;
  await newsQueue.add("refresh", options, {
    repeat: { every: 15 * 60 * 1000 }, // every 15 minutes
    jobId,
  });
}
