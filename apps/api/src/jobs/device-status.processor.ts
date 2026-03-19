import type { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { createWorker, createQueue, QUEUE_NAMES } from "../lib/bullmq.js";
import { markStaleDevicesOffline } from "../modules/devices/devices.service.js";

const prisma = new PrismaClient();

export const deviceStatusQueue = createQueue(QUEUE_NAMES.DEVICE_STATUS);

export function startDeviceStatusWorker() {
  return createWorker(
    QUEUE_NAMES.DEVICE_STATUS,
    async (_job: Job) => {
      const count = await markStaleDevicesOffline(prisma, 3);
      if (count > 0) {
        // Log is handled by the worker's completed event or caller
      }
      return { markedOffline: count };
    }
  );
}

/**
 * Schedules the device status check to run every 2 minutes.
 */
export async function scheduleDeviceStatusCheck(): Promise<void> {
  // Remove existing repeatable jobs to avoid duplicates on restart
  const existingJobs = await deviceStatusQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await deviceStatusQueue.removeRepeatableByKey(job.key);
  }

  await deviceStatusQueue.add(
    "check-device-status",
    {},
    {
      repeat: { every: 2 * 60 * 1000 }, // every 2 minutes
    }
  );
}
