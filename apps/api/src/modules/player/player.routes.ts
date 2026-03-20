import type { FastifyPluginAsync } from "fastify";
import { getCachedPlaylist } from "./player.service.js";
import { getPlayerWidgets } from "./player-widgets.service.js";

const playerRoutes: FastifyPluginAsync = async (fastify) => {
  // All player routes require a player token
  fastify.addHook("preHandler", fastify.authenticatePlayer);

  /**
   * GET /player/playlist
   * Returns the currently cached playlist for this device.
   * The player calls this on startup / reconnect to get the latest state.
   */
  fastify.get("/player/playlist", async (request, reply) => {
    const { deviceId } = request.player;

    const playlist = await getCachedPlaylist(fastify.redis, deviceId);

    if (!playlist) {
      return reply.status(204).send();
    }

    return reply.send({ data: playlist });
  });

  /**
   * GET /player/widgets
   * Returns weather and news data based on tenant widget configurations.
   * The player calls this periodically (every updateIntervalMinutes).
   */
  fastify.get("/player/widgets", async (request, reply) => {
    const { tenantId } = request.player;

    try {
      const widgets = await getPlayerWidgets(
        fastify.prisma,
        fastify.redis,
        tenantId
      );
      return reply.send({ data: widgets });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default playerRoutes;
