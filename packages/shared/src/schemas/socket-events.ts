import { z } from "zod";
import { PlaylistSchema } from "./playlist.schema.js";

// Server -> Client events
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

// Client -> Server events
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

// Typed Socket.io event maps
export interface ServerToClientEvents {
  "playlist:update": (payload: PlaylistUpdatePayload) => void;
  "screen:reboot": (payload: { screenId: string }) => void;
  "screen:refresh-content": (payload: { screenId: string }) => void;
  "screen:status": (payload: ScreenStatusPayload) => void;
  "screen:command": (payload: {
    screenId: string;
    command: string;
    args?: Record<string, unknown>;
  }) => void;
}

export interface ClientToServerEvents {
  "screen:heartbeat": (payload: HeartbeatPayload) => void;
  "screen:error": (payload: ScreenErrorPayload) => void;
  "screen:join": (payload: { screenId: string; tenantId: string }) => void;
  "monitor:join": (payload: { tenantId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  screenId?: string;
  tenantId?: string;
  userId?: string;
  role?: string;
}
