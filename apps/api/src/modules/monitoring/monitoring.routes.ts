import type { FastifyPluginAsync } from "fastify";
import {
  getDashboardStats,
  getScreenTimeline,
  getOnlineScreens,
} from "./monitoring.service.js";

const monitoringRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/monitoring/stats", async (request, reply) => {
    const stats = await getDashboardStats(fastify.prisma, request.user.tenantId);
    return reply.send({ data: stats });
  });

  fastify.get("/monitoring/screens/online", async (request, reply) => {
    const screens = await getOnlineScreens(
      fastify.prisma,
      request.user.tenantId
    );
    return reply.send({ data: screens });
  });

  fastify.get("/monitoring/screens/:id/timeline", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { from?: string; to?: string };

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 24 * 60 * 60 * 1000);

    try {
      const timeline = await getScreenTimeline(
        fastify.prisma,
        request.user.tenantId,
        id,
        from,
        to
      );
      return reply.send({ data: timeline });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default monitoringRoutes;
