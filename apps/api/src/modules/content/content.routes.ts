import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listContent,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
} from "./content.service.js";
import { uploadFile, MINIO_BUCKET } from "../../lib/minio.js";
import { randomUUID } from "crypto";

const ContentTypeEnum = z.enum([
  "IMAGE",
  "VIDEO",
  "HTML",
  "ANNOUNCEMENT",
  "NEWS_FEED",
  "WEATHER_WIDGET",
  "CLOCK",
  "TICKER",
]);

const CreateContentBody = z.object({
  name: z.string().min(1).max(255),
  type: ContentTypeEnum,
  url: z.string().url().optional(),
  body: z.record(z.unknown()).optional(),
  durationSec: z.number().int().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateContentBody = CreateContentBody.partial().extend({
  isActive: z.boolean().optional(),
});

const contentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/content", async (request, reply) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      search?: string;
      type?: string;
      tags?: string;
    };
    const result = await listContent(fastify.prisma, request.user.tenantId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
      search: query.search,
      type: query.type as Parameters<typeof listContent>[2]["type"],
      tags: query.tags ? query.tags.split(",") : undefined,
    });
    return reply.send({
      data: result.content,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  });

  fastify.get("/content/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const content = await getContentById(
        fastify.prisma,
        request.user.tenantId,
        id
      );
      return reply.send({ data: content });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.post("/content", async (request, reply) => {
    const parsed = CreateContentBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const content = await createContent(
        fastify.prisma,
        request.user.tenantId,
        parsed.data
      );
      return reply.status(201).send({ data: content });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // File upload endpoint
  fastify.post("/content/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided", code: "NO_FILE" });
    }

    const ext = data.filename.split(".").pop() ?? "bin";
    const objectName = `${request.user.tenantId}/${randomUUID()}.${ext}`;
    const buffer = await data.toBuffer();

    const path = await uploadFile(objectName, buffer, data.mimetype);
    const url = `http://${process.env["MINIO_ENDPOINT"] ?? "localhost"}:${process.env["MINIO_PORT"] ?? "9000"}${path}`;

    return reply.send({ data: { url, objectName, bucket: MINIO_BUCKET } });
  });

  fastify.patch("/content/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateContentBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const content = await updateContent(
        fastify.prisma,
        request.user.tenantId,
        id,
        parsed.data
      );
      return reply.send({ data: content });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.delete("/content/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteContent(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default contentRoutes;
