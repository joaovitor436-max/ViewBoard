import type { Job } from "bullmq";
import IORedis from "ioredis";
import { createWorker, createQueue, QUEUE_NAMES } from "../lib/bullmq.js";
import { getWeather } from "../modules/integrations/weather.service.js";

export interface WeatherJobData {
  city: string;
  units?: "metric" | "imperial";
}

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const weatherQueue = createQueue<WeatherJobData>(QUEUE_NAMES.WEATHER);

export function startWeatherWorker() {
  return createWorker<WeatherJobData>(
    QUEUE_NAMES.WEATHER,
    async (job: Job<WeatherJobData>) => {
      const { city, units = "metric" } = job.data;
      await getWeather(redis, city, units);
    },
    { concurrency: 3 }
  );
}

export async function scheduleWeatherRefresh(
  city: string,
  units: "metric" | "imperial" = "metric"
): Promise<void> {
  await weatherQueue.add(
    "refresh",
    { city, units },
    {
      repeat: { every: 10 * 60 * 1000 }, // every 10 minutes
      jobId: `weather:${city}:${units}`,
    }
  );
}
