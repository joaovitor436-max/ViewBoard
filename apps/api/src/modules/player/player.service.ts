import type { PrismaClient } from "@prisma/client";
import type IORedis from "ioredis";
import type { Server } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  DevicePlaylistPayload,
  DevicePlaylistItem,
} from "@viewboard/shared";

type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const PLAYLIST_TTL = 60 * 60 * 24; // 24 hours

/**
 * Resolves a playlist into the flat payload format the player expects.
 */
export async function resolvePlaylistForDevice(
  prisma: PrismaClient,
  playlistId: string,
  tenantId: string
): Promise<DevicePlaylistPayload> {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, tenantId },
    include: {
      layout: true,
      items: {
        include: {
          media: {
            select: {
              id: true,
              name: true,
              type: true,
              url: true,
              thumbnailUrl: true,
              duration: true,
            },
          },
          content: {
            select: {
              id: true,
              name: true,
              type: true,
              url: true,
              body: true,
              durationSec: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!playlist) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  const items: DevicePlaylistItem[] = [];
  for (const item of playlist.items) {
    if (item.media) {
      items.push({
        id: item.id,
        order: item.order,
        type: item.media.type as string,
        name: item.media.name,
        url: item.media.url,
        thumbnailUrl: item.media.thumbnailUrl,
        durationSec: item.durationSec ?? item.media.duration ?? 10,
      });
    } else if (item.content) {
      items.push({
        id: item.id,
        order: item.order,
        type: item.content.type as string,
        name: item.content.name,
        url: item.content.url,
        body: item.content.body as Record<string, unknown> | null,
        durationSec: item.durationSec ?? item.content.durationSec ?? 10,
      });
    }
  }

  return {
    id: playlist.id,
    name: playlist.name,
    layout: playlist.layout
      ? { id: playlist.layout.id, name: playlist.layout.name, zones: playlist.layout.zones }
      : null,
    items,
    publishedAt: new Date().toISOString(),
  };
}

/**
 * Caches the resolved playlist in Redis keyed by deviceId.
 */
export async function cachePlaylistForDevice(
  redis: IORedis,
  deviceId: string,
  payload: DevicePlaylistPayload
): Promise<void> {
  const key = `device:${deviceId}:playlist`;
  await redis.setex(key, PLAYLIST_TTL, JSON.stringify(payload));
}

/**
 * Retrieves the cached playlist for a device from Redis.
 */
export async function getCachedPlaylist(
  redis: IORedis,
  deviceId: string
): Promise<DevicePlaylistPayload | null> {
  const key = `device:${deviceId}:playlist`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as DevicePlaylistPayload;
}

/**
 * Publishes a playlist to one or more devices:
 * 1. Resolves the playlist with full media URLs
 * 2. Caches in Redis per device
 * 3. Emits playlist:update via WebSocket to each device room
 */
export async function publishPlaylistToDevices(
  prisma: PrismaClient,
  redis: IORedis,
  io: IO,
  tenantId: string,
  playlistId: string,
  deviceIds: string[]
): Promise<{ published: number; deviceIds: string[] }> {
  // Validate all devices belong to this tenant
  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds }, tenantId },
    select: { id: true },
  });

  if (devices.length === 0) {
    throw Object.assign(new Error("No valid devices found"), {
      statusCode: 404,
      code: "DEVICES_NOT_FOUND",
    });
  }

  const validIds = devices.map((d) => d.id);
  const payload = await resolvePlaylistForDevice(prisma, playlistId, tenantId);

  // Cache and emit to each device
  await Promise.all(
    validIds.map(async (deviceId) => {
      await cachePlaylistForDevice(redis, deviceId, payload);
      io.to(`device:${deviceId}`).emit("playlist:update", payload);
    })
  );

  return { published: validIds.length, deviceIds: validIds };
}
