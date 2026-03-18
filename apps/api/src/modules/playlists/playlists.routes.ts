import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
} from "./playlists.service.js";

const PlaylistItemSchema = z.object({
  contentId: z.string().cuid(),
  zoneId: z.string().min(1),
  order: z.number().int().min(0),
  durationSec: z.number().int().min(1).optional(),
});

const CreatePlaylistBody = z.object({
  name: z.string().min(1).max(255),
  layoutId: z.string().cuid(),
  isDefault: z.boolean().optional(),
  items: z.array(PlaylistItemSchema).optional(),
});

const UpdatePlaylistBody = z.object({
  name: z.string().min(1).max(255).optional(),
  layoutId: z.string().cuid().optional(),
  isDefault: z.boolean().optional(),
  items: z.array(PlaylistItemSchema).optional(),
});

const playlistsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/playlists", async (request, reply) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      search?: string;
    };
    const result = await listPlaylists(fastify.prisma, request.user.tenantId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
      search: query.search,
    });
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
      const playlist = await createPlaylist(
        fastify.prisma,
        request.user.tenantId,
        parsed.data
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
      const playlist = await updatePlaylist(
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
};

export default playlistsRoutes;
