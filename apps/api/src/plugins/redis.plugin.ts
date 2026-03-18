import fp from "fastify-plugin";
import IORedis from "ioredis";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    redis: IORedis;
  }
}

const redisPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

  const redis = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    lazyConnect: false,
  });

  redis.on("error", (err: Error) => {
    fastify.log.error({ err }, "Redis connection error");
  });

  redis.on("connect", () => {
    fastify.log.info("Redis connected");
  });

  await redis.ping();

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
});

export default redisPlugin;
