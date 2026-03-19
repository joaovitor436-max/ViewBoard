import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export function createRedisConnection(): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function createQueue<T = unknown>(name: string): Queue<T> {
  const connection = createRedisConnection();
  return new Queue<T>(name, { connection });
}

export function createWorker<T = unknown, R = unknown>(
  name: string,
  processor: Processor<T, R>,
  options: Partial<WorkerOptions> = {}
): Worker<T, R> {
  const connection = createRedisConnection();
  return new Worker<T, R>(name, processor, {
    connection,
    concurrency: 5,
    ...options,
  });
}

export const QUEUE_NAMES = {
  SCHEDULE: "schedule-processor",
  NEWS: "news-fetcher",
  WEATHER: "weather-fetcher",
  DEVICE_STATUS: "device-status-checker",
} as const;
