import { z } from "zod";
import { ContentSchema } from "./content.schema.js";

export const PlaylistItemSchema = z.object({
  id: z.string().cuid(),
  playlistId: z.string().cuid(),
  contentId: z.string().cuid(),
  zoneId: z.string(),
  order: z.number().int().min(0),
  durationSec: z.number().int().min(1).nullable().optional(),
  content: ContentSchema.optional(),
});

export type PlaylistItem = z.infer<typeof PlaylistItemSchema>;

export const PlaylistSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
  name: z.string().min(1).max(255),
  layoutId: z.string().cuid(),
  isDefault: z.boolean().default(false),
  createdAt: z.date(),
  items: z.array(PlaylistItemSchema).optional(),
});

export type Playlist = z.infer<typeof PlaylistSchema>;

export const CreatePlaylistItemSchema = z.object({
  contentId: z.string().cuid(),
  zoneId: z.string().min(1),
  order: z.number().int().min(0),
  durationSec: z.number().int().min(1).optional(),
});

export type CreatePlaylistItem = z.infer<typeof CreatePlaylistItemSchema>;

export const CreatePlaylistSchema = z.object({
  name: z.string().min(1).max(255),
  layoutId: z.string().cuid(),
  isDefault: z.boolean().default(false),
  items: z.array(CreatePlaylistItemSchema).default([]),
});

export type CreatePlaylist = z.infer<typeof CreatePlaylistSchema>;

export const UpdatePlaylistSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  layoutId: z.string().cuid().optional(),
  isDefault: z.boolean().optional(),
  items: z.array(CreatePlaylistItemSchema).optional(),
});

export type UpdatePlaylist = z.infer<typeof UpdatePlaylistSchema>;
