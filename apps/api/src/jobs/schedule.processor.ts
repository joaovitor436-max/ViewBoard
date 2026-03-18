import type { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { createWorker, createQueue, QUEUE_NAMES } from "../lib/bullmq.js";
import { resolveActivePlaylist } from "../modules/schedules/schedules.service.js";
import { Server } from "socket.io";

export interface ScheduleJobData {
  tenantId: string;
  screenId: string;
}

const prisma = new PrismaClient();

export const scheduleQueue = createQueue<ScheduleJobData>(
  QUEUE_NAMES.SCHEDULE
);

export function startScheduleWorker(
  io: Server
) {
  return createWorker<ScheduleJobData>(
    QUEUE_NAMES.SCHEDULE,
    async (job: Job<ScheduleJobData>) => {
      const { tenantId, screenId } = job.data;
      const now = new Date();

      const playlist = await resolveActivePlaylist(
        prisma,
        tenantId,
        screenId,
        now
      );

      if (!playlist) {
        // No active schedule - check if there is a default playlist
        const defaultPlaylist = await prisma.playlist.findFirst({
          where: { tenantId, isDefault: true },
          include: {
            items: { include: { content: true }, orderBy: { order: "asc" } },
            layout: true,
          },
        });

        if (defaultPlaylist) {
          await prisma.screen.update({
            where: { id: screenId },
            data: { currentPlaylistId: defaultPlaylist.id },
          });

          io.to(`screen:${screenId}`).emit("playlist:update", {
            screenId,
            playlist: defaultPlaylist as never,
            triggeredAt: now.toISOString(),
          });
        }
        return;
      }

      // Check if playlist changed
      const screen = await prisma.screen.findUnique({
        where: { id: screenId },
        select: { currentPlaylistId: true },
      });

      if (screen?.currentPlaylistId !== playlist.id) {
        await prisma.screen.update({
          where: { id: screenId },
          data: { currentPlaylistId: playlist.id },
        });

        io.to(`screen:${screenId}`).emit("playlist:update", {
          screenId,
          playlist: playlist as never,
          triggeredAt: now.toISOString(),
        });
      }
    }
  );
}

/**
 * Enqueue schedule resolution jobs for all screens in a tenant.
 */
export async function enqueueScheduleResolution(tenantId: string): Promise<void> {
  const screens = await prisma.screen.findMany({
    where: { tenantId, status: "ONLINE" },
    select: { id: true },
  });

  const jobs = screens.map((screen) => ({
    name: "resolve",
    data: { tenantId, screenId: screen.id },
  }));

  if (jobs.length > 0) {
    await scheduleQueue.addBulk(jobs);
  }
}
