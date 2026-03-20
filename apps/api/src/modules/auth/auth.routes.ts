import type { FastifyPluginAsync } from "fastify";
import { LoginSchema, RefreshTokenSchema, ScreenPairSchema } from "./auth.schema.js";
import { login, refreshTokens, logout, pairScreen } from "./auth.service.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Auth"],
        summary: "Login de utilizador",
        description: "Autentica um utilizador e retorna tokens JWT",
        body: {
          type: "object",
          required: ["email", "password", "tenantSlug"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
            tenantSlug: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            description: "Login bem sucedido",
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                  expiresIn: { type: "number" },
                  user: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      email: { type: "string" },
                      name: { type: "string" },
                      role: { type: "string" },
                      tenantId: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
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
    }
  );

  fastify.post(
    "/auth/refresh",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Auth"],
        summary: "Renovar token",
        description: "Renova o access token usando o refresh token",
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
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
    }
  );

  fastify.post(
    "/auth/logout",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Auth"],
        summary: "Logout",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      await logout(fastify.redis, request.user.sub);
      return reply.status(204).send();
    }
  );

  fastify.post(
    "/auth/screen/pair",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Auth"],
        summary: "Pareamento de tela",
        description: "Pareia uma tela usando código de pareamento",
        body: {
          type: "object",
          required: ["pairingCode"],
          properties: {
            pairingCode: { type: "string", minLength: 1, maxLength: 20 },
          },
        },
      },
    },
    async (request, reply) => {
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
    }
  );
};

export default authRoutes;
