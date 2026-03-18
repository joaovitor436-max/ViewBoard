import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listLayouts,
  getLayoutById,
  createLayout,
  updateLayout,
  deleteLayout,
} from "./layouts.service.js";

const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  zIndex: z.number().int().min(0).default(0),
  allowedContentTypes: z.array(z.string()).optional(),
});

const CreateLayoutBody = z.object({
  name: z.string().min(1).max(255),
  zones: z.array(ZoneSchema).min(1),
});

const UpdateLayoutBody = z.object({
  name: z.string().min(1).max(255).optional(),
  zones: z.array(ZoneSchema).min(1).optional(),
});

const layoutsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/layouts", async (request, reply) => {
    const layouts = await listLayouts(fastify.prisma, request.user.tenantId);
    return reply.send({ data: layouts });
  });

  fastify.get("/layouts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const layout = await getLayoutById(
        fastify.prisma,
        request.user.tenantId,
        id
      );
      return reply.send({ data: layout });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.post("/layouts", async (request, reply) => {
    const parsed = CreateLayoutBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const layout = await createLayout(
        fastify.prisma,
        request.user.tenantId,
        parsed.data
      );
      return reply.status(201).send({ data: layout });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.patch("/layouts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateLayoutBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const layout = await updateLayout(
        fastify.prisma,
        request.user.tenantId,
        id,
        parsed.data
      );
      return reply.send({ data: layout });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.delete("/layouts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteLayout(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default layoutsRoutes;
