import type { FastifyPluginAsync } from "fastify";
import { getCachedPlaylist } from "./player.service.js";

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
};

export default playerRoutes;
