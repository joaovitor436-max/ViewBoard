import type { FastifyPluginAsync } from "fastify";
import { uploadMedia, listMedia, getMediaById, deleteMedia } from "./media.service.js";
import { validateMimeType } from "../../lib/mime-validator.js";

const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // POST /media/upload — multipart file upload
  fastify.post(
    "/media/upload",
    {
      schema: {
        tags: ["Media"],
        summary: "Upload de mídia",
        description: "Faz upload de imagem ou vídeo para a biblioteca de mídias",
        consumes: ["multipart/form-data"],
        security: [{ bearerAuth: [] }],
        response: {
          201: {
            description: "Mídia criada com sucesso",
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  type: { type: "string", enum: ["IMAGE", "VIDEO"] },
                  url: { type: "string" },
                  thumbnailUrl: { type: "string", nullable: true },
                  sizeBytes: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No file provided", code: "NO_FILE" });
      }

      const buffer = await data.toBuffer();

      // Validação MIME real (magic bytes)
      const mimeCheck = validateMimeType(data.mimetype, buffer);
      if (!mimeCheck.valid) {
        return reply.status(400).send({
          error: `Tipo de ficheiro não permitido. Declarado: ${mimeCheck.declaredMime}, detectado: ${mimeCheck.detectedMime ?? "desconhecido"}`,
          code: "INVALID_MIME_TYPE",
        });
      }

      try {
        const media = await uploadMedia(
          fastify.prisma,
          request.user.tenantId,
          request.user.sub,
          {
            filename: data.filename,
            mimetype: mimeCheck.detectedMime ?? data.mimetype,
            buffer,
          }
        );
        return reply.status(201).send({ data: media });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message: string };
        return reply
          .status(e.statusCode ?? 500)
          .send({ error: e.message, code: e.code ?? "UPLOAD_FAILED" });
      }
    }
  );

  // GET /media — list media with pagination
  fastify.get(
    "/media",
    {
      schema: {
        tags: ["Media"],
        summary: "Listar mídias",
        description: "Lista mídias com paginação e busca",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            search: { type: "string" },
            type: { type: "string", enum: ["IMAGE", "VIDEO"] },
          },
        },
        response: {
          200: {
            description: "Lista de mídias",
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    type: { type: "string" },
                    url: { type: "string" },
                    thumbnailUrl: { type: "string", nullable: true },
                    duration: { type: "number", nullable: true },
                    sizeBytes: { type: "number" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
              meta: {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  pageSize: { type: "integer" },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
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
    }
  );

  // GET /media/:id
  fastify.get(
    "/media/:id",
    {
      schema: {
        tags: ["Media"],
        summary: "Obter mídia por ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
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
    }
  );

  // DELETE /media/:id
  fastify.delete(
    "/media/:id",
    {
      schema: {
        tags: ["Media"],
        summary: "Excluir mídia",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
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
    }
  );
};

export default mediaRoutes;
