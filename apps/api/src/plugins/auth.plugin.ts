import fp from "fastify-plugin";
import { jwtVerify, type JWTPayload } from "jose";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { JwtPayload, PlayerJwtPayload } from "@viewboard/shared";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;
    authenticatePlayer: (
      request: FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user: JwtPayload;
    player: PlayerJwtPayload;
  }
}

const authPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const JWT_SECRET = process.env["JWT_SECRET"] ?? "fallback-secret-change-me";
  const secret = new TextEncoder().encode(JWT_SECRET);

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: import("fastify").FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "MISSING_TOKEN",
        });
      }

      const token = authHeader.slice(7);
      try {
        const { payload } = await jwtVerify(token, secret);
        const decoded = payload as unknown as JwtPayload;
        // Reject player tokens on admin routes
        if (decoded.type === "player") {
          return reply.status(403).send({
            error: "Forbidden",
            code: "INSUFFICIENT_SCOPE",
          });
        }
        request.user = decoded;
      } catch {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "INVALID_TOKEN",
        });
      }
    }
  );

  // Player-scoped authentication (for device heartbeat/pairing)
  fastify.decorate(
    "authenticatePlayer",
    async (request: FastifyRequest, reply: import("fastify").FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "MISSING_TOKEN",
        });
      }

      const token = authHeader.slice(7);
      try {
        const { payload } = await jwtVerify(token, secret);
        const decoded = payload as unknown as PlayerJwtPayload;
        if (decoded.type !== "player" || !decoded.deviceId) {
          return reply.status(403).send({
            error: "Forbidden",
            code: "INVALID_PLAYER_TOKEN",
          });
        }
        request.player = decoded;
      } catch {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "INVALID_TOKEN",
        });
      }
    }
  );

  // Decorate request with a default empty user to avoid type errors
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("player", null);
});

export default authPlugin;
