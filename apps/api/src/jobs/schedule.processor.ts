import type { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { createWorker, createQueue, QUEUE_NAMES } from "../lib/bullmq.js";
import {
  resolveActiveScheduleForDevice,
  getDefaultPlaylistId,
} from "../modules/schedules/schedules.service.js";
import {
  resolvePlaylistForDevice,
  cachePlaylistForDevice,
} from "../modules/player/player.service.js";
import type { Server } from "socket.io";
import type IORedis from "ioredis";

export interface ScheduleJobData {
  type: "tick" | "resolve-device";
  tenantId?: string;
  deviceId?: string;
}

const prisma = new PrismaClient();

export const scheduleQueue = createQueue<ScheduleJobData>(
  QUEUE_NAMES.SCHEDULE
);

/**
 * Motor de agendamento — corre a cada minuto.
 * 1. Busca todos os dispositivos ONLINE
 * 2. Para cada um, resolve qual schedule tem prioridade
 * 3. Se mudou, emite playlist:update via WebSocket e regista no ScheduleLog
 * 4. Se não há schedule ativo, restaura a playlist padrão
 */
export function startScheduleWorker(io: Server, redis?: IORedis) {
  return createWorker<ScheduleJobData>(
    QUEUE_NAMES.SCHEDULE,
    async (job: Job<ScheduleJobData>) => {
      if (job.data.type === "tick") {
        return await processScheduleTick(io, redis);
      }

      if (job.data.type === "resolve-device" && job.data.tenantId && job.data.deviceId) {
        return await processDeviceSchedule(
          io,
          redis,
          job.data.tenantId,
          job.data.deviceId
        );
      }
    }
  );
}

async function processScheduleTick(io: Server, redis?: IORedis) {
  // Buscar todos os dispositivos ONLINE
  const devices = await prisma.device.findMany({
    where: { status: "ONLINE" },
    select: { id: true, tenantId: true },
  });

  let processed = 0;
  let updated = 0;

  for (const device of devices) {
    const changed = await processDeviceSchedule(io, redis, device.tenantId, device.id);
    processed++;
    if (changed) updated++;
  }

  return { processed, updated };
}

/**
 * Resolve o agendamento para um dispositivo específico.
 * Retorna true se a playlist foi alterada.
 */
async function processDeviceSchedule(
  io: Server,
  redis: IORedis | undefined,
  tenantId: string,
  deviceId: string
): Promise<boolean> {
  const now = new Date();

  try {
    const activeSchedule = await resolveActiveScheduleForDevice(
      prisma,
      tenantId,
      deviceId,
      now
    );

    // Verificar qual playlist está em cache para este dispositivo
    const currentCacheKey = `device:${deviceId}:active-schedule`;
    let currentScheduleId: string | null = null;

    if (redis) {
      currentScheduleId = await redis.get(currentCacheKey);
    }

    if (activeSchedule) {
      // Há um schedule ativo
      if (currentScheduleId === activeSchedule.scheduleId) {
        // Já está a executar o schedule correto — nada a fazer
        return false;
      }

      // Mudou: resolver e emitir a nova playlist
      try {
        const payload = await resolvePlaylistForDevice(
          prisma,
          activeSchedule.playlistId,
          tenantId
        );

        // Cache para o dispositivo
        if (redis) {
          await cachePlaylistForDevice(redis, deviceId, payload);
          await redis.set(currentCacheKey, activeSchedule.scheduleId, "EX", 86400);
        }

        // Emitir via WebSocket
        io.to(`device:${deviceId}`).emit("playlist:update", payload);

        // Registar no log
        await prisma.scheduleLog.create({
          data: {
            scheduleId: activeSchedule.scheduleId,
            deviceId,
            status: "SUCCESS",
            message: `Playlist "${payload.name}" ativada`,
          },
        });

        return true;
      } catch (err) {
        // Registar erro
        await prisma.scheduleLog.create({
          data: {
            scheduleId: activeSchedule.scheduleId,
            deviceId,
            status: "ERROR",
            message: err instanceof Error ? err.message : "Erro desconhecido",
          },
        });
        return false;
      }
    } else {
      // Sem schedule ativo: restaurar playlist padrão
      if (!currentScheduleId) {
        // Já está na playlist padrão
        return false;
      }

      // Limpar o registo de schedule ativo
      if (redis) {
        await redis.del(currentCacheKey);
      }

      const defaultPlaylistId = await getDefaultPlaylistId(prisma, tenantId);
      if (defaultPlaylistId) {
        try {
          const payload = await resolvePlaylistForDevice(
            prisma,
            defaultPlaylistId,
            tenantId
          );

          if (redis) {
            await cachePlaylistForDevice(redis, deviceId, payload);
          }

          io.to(`device:${deviceId}`).emit("playlist:update", payload);
          return true;
        } catch {
          // Playlist padrão não existe — ignorar
        }
      }

      return false;
    }
  } catch (err) {
    console.error(`Erro ao processar schedule para device ${deviceId}:`, err);
    return false;
  }
}

/**
 * Agenda o tick do motor de agendamento — corre a cada minuto.
 */
export async function scheduleScheduleTick(): Promise<void> {
  await scheduleQueue.add(
    "schedule-tick",
    { type: "tick" },
    {
      repeat: { every: 60_000 }, // cada minuto
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
}
