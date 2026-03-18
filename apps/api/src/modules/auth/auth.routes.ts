import type { FastifyPluginAsync } from "fastify";
import { LoginSchema, RefreshTokenSchema, ScreenPairSchema } from "./auth.schema.js";
import { login, refreshTokens, logout, pairScreen } from "./auth.service.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/auth/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await login(fastify.prisma, fastify.redis, parsed.data);
      return reply.status(200).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({
        error: e.message,
        code: e.code ?? "INTERNAL_ERROR",
      });
    }
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const parsed = RefreshTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await refreshTokens(
        fastify.prisma,
        fastify.redis,
        parsed.data.refreshToken
      );
      return reply.status(200).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({
        error: e.message,
        code: e.code ?? "INTERNAL_ERROR",
      });
    }
  });

  fastify.post(
    "/auth/logout",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await logout(fastify.redis, request.user.sub);
      return reply.status(204).send();
    }
  );

  fastify.post("/auth/screen/pair", async (request, reply) => {
    const parsed = ScreenPairSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await pairScreen(fastify.prisma, parsed.data);
      return reply.status(200).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply.status(e.statusCode ?? 500).send({
        error: e.message,
        code: e.code ?? "INTERNAL_ERROR",
      });
    }
  });
};

export default authRoutes;
