import type { FastifyPluginAsync } from "fastify";
import { getWeather } from "./weather.service.js";
import { getTopHeadlines } from "./news.service.js";

const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/integrations/weather", async (request, reply) => {
    const query = request.query as {
      city?: string;
      units?: "metric" | "imperial";
    };

    if (!query.city) {
      return reply.status(400).send({
        error: "city parameter is required",
        code: "MISSING_CITY",
      });
    }

    try {
      const weather = await getWeather(
        fastify.redis,
        query.city,
        query.units ?? "metric"
      );
      return reply.send({ data: weather });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.get("/integrations/news", async (request, reply) => {
    const query = request.query as {
      country?: string;
      category?: string;
      q?: string;
      pageSize?: string;
    };

    try {
      const articles = await getTopHeadlines(fastify.redis, {
        country: query.country,
        category: query.category,
        q: query.q,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 10,
      });
      return reply.send({ data: articles });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default integrationsRoutes;
