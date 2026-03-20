import { z } from "zod";
import { PlaylistSchema } from "./playlist.schema.js";

// Server -> Client events (Screen)
export const PlaylistUpdatePayloadSchema = z.object({
  screenId: z.string(),
  playlist: PlaylistSchema,
  triggeredAt: z.string().datetime(),
});

export type PlaylistUpdatePayload = z.infer<typeof PlaylistUpdatePayloadSchema>;

export const ScreenStatusPayloadSchema = z.object({
  screenId: z.string(),
  status: z.enum(["ONLINE", "OFFLINE", "ERROR"]),
  lastSeenAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ScreenStatusPayload = z.infer<typeof ScreenStatusPayloadSchema>;

// Client -> Server events (Screen)
export const HeartbeatPayloadSchema = z.object({
  screenId: z.string(),
  timestamp: z.string().datetime(),
  metadata: z
    .object({
      cpuUsage: z.number().optional(),
      memoryUsage: z.number().optional(),
      uptime: z.number().optional(),
      currentPlaylistId: z.string().optional(),
      ip: z.string().optional(),
    })
    .optional(),
});

export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;

export const ScreenErrorPayloadSchema = z.object({
  screenId: z.string(),
  error: z.string(),
  stack: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type ScreenErrorPayload = z.infer<typeof ScreenErrorPayloadSchema>;

// ── Device/Player events (Phase 4 – Chromecast Player) ──────────────

/** Preview item sent to the player (resolved with URLs) */
export const DevicePlaylistItemSchema = z.object({
  id: z.string(),
  order: z.number(),
  type: z.string(),
  name: z.string(),
  url: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  body: z.record(z.unknown()).nullable().optional(),
  durationSec: z.number(),
});

export type DevicePlaylistItem = z.infer<typeof DevicePlaylistItemSchema>;

/** Full playlist payload pushed to device players */
export const DevicePlaylistPayloadSchema = z.object({
  id: z.string(),
  name: z.string(),
  layout: z.record(z.unknown()).nullable().optional(),
  items: z.array(DevicePlaylistItemSchema),
  publishedAt: z.string(),
});

export type DevicePlaylistPayload = z.infer<typeof DevicePlaylistPayloadSchema>;

/** Device config pushed when device settings change */
export const DeviceConfigPayloadSchema = z.object({
  deviceId: z.string(),
  config: z.record(z.unknown()),
});

export type DeviceConfigPayload = z.infer<typeof DeviceConfigPayloadSchema>;

/** Layout config pushed when layout is assigned or updated */
export const DeviceLayoutPayloadSchema = z.object({
  deviceId: z.string(),
  layout: z.object({
    template: z.enum(["FULLSCREEN", "SPLIT_BOTTOM", "SPLIT_SIDE", "GRID"]),
    zones: z.array(z.record(z.unknown())),
    config: z.record(z.unknown()),
  }),
});

export type DeviceLayoutPayload = z.infer<typeof DeviceLayoutPayloadSchema>;

// Typed Socket.io event maps
export interface ServerToClientEvents {
  // Screen events
  "playlist:update": (payload: PlaylistUpdatePayload | DevicePlaylistPayload) => void;
  "screen:reboot": (payload: { screenId: string }) => void;
  "screen:refresh-content": (payload: { screenId: string }) => void;
  "screen:status": (payload: ScreenStatusPayload) => void;
  "screen:command": (payload: {
    screenId: string;
    command: string;
    args?: Record<string, unknown>;
  }) => void;
  // Device player events
  "device:config": (payload: DeviceConfigPayload) => void;
  ping: () => void;
}

export interface ClientToServerEvents {
  // Screen events
  "screen:heartbeat": (payload: HeartbeatPayload) => void;
  "screen:error": (payload: ScreenErrorPayload) => void;
  "screen:join": (payload: { screenId: string; tenantId: string }) => void;
  "monitor:join": (payload: { tenantId: string }) => void;
  // Device player events
  "device:join": (payload: { deviceId: string; tenantId: string; token: string }) => void;
  "device:heartbeat": (payload: { deviceId: string; timestamp: string }) => void;
  pong: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  screenId?: string;
  deviceId?: string;
  tenantId?: string;
  userId?: string;
  role?: string;
}
