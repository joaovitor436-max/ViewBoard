import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listScreens,
  getScreenById,
  createScreen,
  updateScreen,
  deleteScreen,
  regeneratePairingCode,
} from "./screens.service.js";

const CreateScreenBody = z.object({
  name: z.string().min(1).max(255),
  location: z.string().optional(),
  orientation: z.enum(["LANDSCAPE", "PORTRAIT"]).optional(),
});

const UpdateScreenBody = z.object({
  name: z.string().min(1).max(255).optional(),
  location: z.string().optional(),
  orientation: z.enum(["LANDSCAPE", "PORTRAIT"]).optional(),
  currentPlaylistId: z.string().optional(),
});

const screensRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/screens", async (request, reply) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      search?: string;
    };
    const result = await listScreens(fastify.prisma, request.user.tenantId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
      search: query.search,
    });
    return reply.send({
      data: result.screens,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  });

  fastify.get("/screens/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const screen = await getScreenById(
        fastify.prisma,
        request.user.tenantId,
        id
      );
      return reply.send({ data: screen });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.post("/screens", async (request, reply) => {
    const parsed = CreateScreenBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const screen = await createScreen(
        fastify.prisma,
        request.user.tenantId,
        parsed.data
      );
      return reply.status(201).send({ data: screen });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.patch("/screens/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateScreenBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const screen = await updateScreen(
        fastify.prisma,
        request.user.tenantId,
        id,
        parsed.data
      );
      return reply.send({ data: screen });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.delete("/screens/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteScreen(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.post("/screens/:id/regenerate-pairing", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await regeneratePairingCode(
        fastify.prisma,
        request.user.tenantId,
        id
      );
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // Send command to screen via Socket.io
  fastify.post("/screens/:id/command", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { command: string; args?: Record<string, unknown> };

    fastify.io.to(`screen:${id}`).emit("screen:command", {
      screenId: id,
      command: body.command,
      args: body.args,
    });

    return reply.send({ data: { sent: true } });
  });

  // Reboot screen
  fastify.post("/screens/:id/reboot", async (request, reply) => {
    const { id } = request.params as { id: string };
    fastify.io.to(`screen:${id}`).emit("screen:reboot", { screenId: id });
    return reply.send({ data: { sent: true } });
  });
};

export default screensRoutes;
