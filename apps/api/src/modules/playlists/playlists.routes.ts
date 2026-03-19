import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addPlaylistItem,
  reorderPlaylistItems,
  removePlaylistItem,
  getPlaylistPreview,
  type CreatePlaylistInput,
  type UpdatePlaylistInput,
  type PlaylistItemInput,
} from "./playlists.service.js";
import { publishPlaylistToDevices } from "../player/player.service.js";

// Strip undefined values so exactOptionalPropertyTypes is satisfied
function stripUndefined(obj: Record<string, unknown>): PlaylistItemInput {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result as unknown as PlaylistItemInput;
}

const PlaylistItemSchema = z.object({
  contentId: z.string().min(1).optional(),
  mediaId: z.string().min(1).optional(),
  zoneId: z.string().min(1).optional(),
  order: z.number().int().min(0),
  durationSec: z.number().int().min(1).optional(),
});

const CreatePlaylistBody = z.object({
  name: z.string().min(1).max(255),
  layoutId: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  items: z.array(PlaylistItemSchema).optional(),
});

const UpdatePlaylistBody = z.object({
  name: z.string().min(1).max(255).optional(),
  layoutId: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  items: z.array(PlaylistItemSchema).optional(),
});

const AddItemBody = z.object({
  mediaId: z.string().min(1).optional(),
  contentId: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
  durationSec: z.number().int().min(1).optional(),
});

const ReorderBody = z.array(
  z.object({
    itemId: z.string().min(1),
    order: z.number().int().min(0),
  })
);

const PublishPlaylistBody = z.object({
  deviceIds: z.array(z.string().min(1)).min(1),
});

const playlistsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/playlists", async (request, reply) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      search?: string;
    };
    const params: Parameters<typeof listPlaylists>[2] = {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    };
    if (query.search) params.search = query.search;

    const result = await listPlaylists(fastify.prisma, request.user.tenantId, params);
    return reply.send({
      data: result.playlists,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  });

  fastify.get("/playlists/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const playlist = await getPlaylistById(
        fastify.prisma,
        request.user.tenantId,
        id
      );
      return reply.send({ data: playlist });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // GET /playlists/:id/preview — full playlist with media URLs for preview player
  fastify.get("/playlists/:id/preview", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const preview = await getPlaylistPreview(
        fastify.prisma,
        request.user.tenantId,
        id
      );
      return reply.send({ data: preview });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.post("/playlists", async (request, reply) => {
    const parsed = CreatePlaylistBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const input: CreatePlaylistInput = { name: parsed.data.name };
      if (parsed.data.layoutId) input.layoutId = parsed.data.layoutId;
      if (parsed.data.isDefault !== undefined) input.isDefault = parsed.data.isDefault;
      if (parsed.data.items) input.items = parsed.data.items.map(stripUndefined);

      const playlist = await createPlaylist(
        fastify.prisma,
        request.user.tenantId,
        input
      );
      return reply.status(201).send({ data: playlist });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.patch("/playlists/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdatePlaylistBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const input: UpdatePlaylistInput = {};
      if (parsed.data.name !== undefined) input.name = parsed.data.name;
      if (parsed.data.layoutId !== undefined) input.layoutId = parsed.data.layoutId;
      if (parsed.data.isDefault !== undefined) input.isDefault = parsed.data.isDefault;
      if (parsed.data.isActive !== undefined) input.isActive = parsed.data.isActive;
      if (parsed.data.items) input.items = parsed.data.items.map(stripUndefined);

      const playlist = await updatePlaylist(
        fastify.prisma,
        request.user.tenantId,
        id,
        input
      );
      return reply.send({ data: playlist });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.delete("/playlists/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deletePlaylist(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // ── Playlist Items ────────────────────────────────────────────────────

  // POST /playlists/:id/items — add media to playlist
  fastify.post("/playlists/:id/items", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = AddItemBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const addInput: Parameters<typeof addPlaylistItem>[3] = {};
      if (parsed.data.mediaId) addInput.mediaId = parsed.data.mediaId;
      if (parsed.data.contentId) addInput.contentId = parsed.data.contentId;
      if (parsed.data.order !== undefined) addInput.order = parsed.data.order;
      if (parsed.data.durationSec !== undefined) addInput.durationSec = parsed.data.durationSec;

      const item = await addPlaylistItem(
        fastify.prisma,
        request.user.tenantId,
        id,
        addInput
      );
      return reply.status(201).send({ data: item });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // PATCH /playlists/:id/items/reorder — reorder items
  fastify.patch("/playlists/:id/items/reorder", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ReorderBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const playlist = await reorderPlaylistItems(
        fastify.prisma,
        request.user.tenantId,
        id,
        parsed.data
      );
      return reply.send({ data: playlist });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // DELETE /playlists/:id/items/:itemId — remove item from playlist
  fastify.delete("/playlists/:id/items/:itemId", async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    try {
      await removePlaylistItem(fastify.prisma, request.user.tenantId, id, itemId);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // ── Publish ─────────────────────────────────────────────────────────

  // POST /playlists/:id/publish — publish playlist to devices via WebSocket + Redis cache
  fastify.post("/playlists/:id/publish", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = PublishPlaylistBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const result = await publishPlaylistToDevices(
        fastify.prisma,
        fastify.redis,
        fastify.io,
        request.user.tenantId,
        id,
        parsed.data.deviceIds
      );
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default playlistsRoutes;
