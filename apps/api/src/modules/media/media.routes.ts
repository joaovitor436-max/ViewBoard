import type { FastifyPluginAsync } from "fastify";
import { uploadMedia, listMedia, getMediaById, deleteMedia } from "./media.service.js";

const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // POST /media/upload — multipart file upload
  fastify.post("/media/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided", code: "NO_FILE" });
    }

    const buffer = await data.toBuffer();

    try {
      const media = await uploadMedia(
        fastify.prisma,
        request.user.tenantId,
        request.user.sub,
        { filename: data.filename, mimetype: data.mimetype, buffer }
      );
      return reply.status(201).send({ data: media });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code ?? "UPLOAD_FAILED" });
    }
  });

  // GET /media — list media with pagination
  fastify.get("/media", async (request, reply) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      search?: string;
      type?: string;
    };

    const params: Parameters<typeof listMedia>[2] = {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    };
    if (query.search) params.search = query.search;
    if (query.type) params.type = query.type as "IMAGE" | "VIDEO";

    const result = await listMedia(fastify.prisma, request.user.tenantId, params);

    return reply.send({
      data: result.media,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  });

  // GET /media/:id
  fastify.get("/media/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const media = await getMediaById(fastify.prisma, request.user.tenantId, id);
      return reply.send({ data: media });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // DELETE /media/:id
  fastify.delete("/media/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteMedia(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default mediaRoutes;
