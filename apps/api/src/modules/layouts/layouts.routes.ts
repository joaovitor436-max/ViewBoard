import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listLayouts,
  getLayoutById,
  createLayout,
  updateLayout,
  deleteLayout,
  assignLayout,
  getPreviewConfig,
} from "./layouts.service.js";

const LayoutTemplateEnum = z.enum(["FULLSCREEN", "SPLIT_BOTTOM", "SPLIT_SIDE", "GRID"]);

const WidgetSchema = z.object({
  type: z.enum(["clock", "weather", "news"]),
  enabled: z.boolean(),
});

const LayoutConfigSchema = z.object({
  backgroundColor: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  widgets: z.array(WidgetSchema).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().min(8).max(72).optional(),
});

const CreateLayoutBody = z.object({
  name: z.string().min(1).max(255),
  template: LayoutTemplateEnum,
  config: LayoutConfigSchema.optional(),
});

const UpdateLayoutBody = z.object({
  name: z.string().min(1).max(255).optional(),
  template: LayoutTemplateEnum.optional(),
  config: LayoutConfigSchema.optional(),
  isDefault: z.boolean().optional(),
});

const AssignBody = z.object({
  deviceId: z.string().optional(),
  groupId: z.string().optional(),
}).refine((d) => d.deviceId || d.groupId, {
  message: "Informe deviceId ou groupId",
});

const layoutsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /layouts — lista layouts do tenant
  fastify.get("/layouts", async (request, reply) => {
    const layouts = await listLayouts(fastify.prisma, request.user.tenantId);
    return reply.send({ data: layouts });
  });

  // GET /layouts/:id — detalhes de um layout
  fastify.get("/layouts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const layout = await getLayoutById(fastify.prisma, request.user.tenantId, id);
      return reply.send({ data: layout });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message, code: e.code });
    }
  });

  // POST /layouts — cria layout com template base
  fastify.post("/layouts", async (request, reply) => {
    const parsed = CreateLayoutBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validação falhou",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const layout = await createLayout(fastify.prisma, request.user.tenantId, parsed.data);
      return reply.status(201).send({ data: layout });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message, code: e.code });
    }
  });

  // PATCH /layouts/:id — atualiza configurações
  fastify.patch("/layouts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateLayoutBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validação falhou",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const layout = await updateLayout(fastify.prisma, request.user.tenantId, id, parsed.data);
      return reply.send({ data: layout });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message, code: e.code });
    }
  });

  // DELETE /layouts/:id — exclui layout
  fastify.delete("/layouts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteLayout(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message, code: e.code });
    }
  });

  // POST /layouts/:id/assign — associa layout a device ou group
  fastify.post("/layouts/:id/assign", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = AssignBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validação falhou",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const result = await assignLayout(fastify.prisma, request.user.tenantId, id, parsed.data);

      // Emitir device:config para o(s) dispositivo(s) afetado(s)
      const previewConfig = await getPreviewConfig(fastify.prisma, request.user.tenantId, id);

      if (parsed.data.deviceId) {
        fastify.io.to(`device:${parsed.data.deviceId}`).emit("device:config", {
          deviceId: parsed.data.deviceId,
          config: { layout: previewConfig },
        });
      }

      if (parsed.data.groupId) {
        // Buscar todos os devices do grupo para notificar
        const devices = await fastify.prisma.device.findMany({
          where: { groupId: parsed.data.groupId, tenantId: request.user.tenantId },
          select: { id: true },
        });
        for (const device of devices) {
          fastify.io.to(`device:${device.id}`).emit("device:config", {
            deviceId: device.id,
            config: { layout: previewConfig },
          });
        }
      }

      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message, code: e.code });
    }
  });

  // GET /layouts/:id/preview-config — config completa para o frontend renderizar
  fastify.get("/layouts/:id/preview-config", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const config = await getPreviewConfig(fastify.prisma, request.user.tenantId, id);
      return reply.send({ data: config });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({ error: e.message, code: e.code });
    }
  });
};

export default layoutsRoutes;
