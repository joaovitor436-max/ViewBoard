import type { FastifyPluginAsync } from "fastify";
import {
  listWidgetConfigs,
  createWidgetConfig,
  updateWidgetConfig,
  deleteWidgetConfig,
} from "./widgets.service.js";

const widgetsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /widgets — list widget configs for current tenant
  fastify.get("/widgets", async (request, reply) => {
    const { tenantId } = request.user;
    const configs = await listWidgetConfigs(fastify.prisma, tenantId);
    return reply.send({ data: configs });
  });

  // POST /widgets — create a widget config
  fastify.post("/widgets", async (request, reply) => {
    const { tenantId } = request.user;
    const body = request.body as {
      type: "NEWS" | "WEATHER";
      config?: Record<string, unknown>;
      isActive?: boolean;
    };

    if (!body.type || !["NEWS", "WEATHER"].includes(body.type)) {
      return reply.status(400).send({
        error: "type must be NEWS or WEATHER",
        code: "INVALID_WIDGET_TYPE",
      });
    }

    try {
      const config = await createWidgetConfig(fastify.prisma, tenantId, body);
      return reply.status(201).send({ data: config });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // PATCH /widgets/:id — update a widget config
  fastify.patch("/widgets/:id", async (request, reply) => {
    const { tenantId } = request.user;
    const { id } = request.params as { id: string };
    const body = request.body as {
      config?: Record<string, unknown>;
      isActive?: boolean;
    };

    try {
      const config = await updateWidgetConfig(fastify.prisma, tenantId, id, body);
      return reply.send({ data: config });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // DELETE /widgets/:id — delete a widget config
  fastify.delete("/widgets/:id", async (request, reply) => {
    const { tenantId } = request.user;
    const { id } = request.params as { id: string };

    try {
      await deleteWidgetConfig(fastify.prisma, tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default widgetsRoutes;
