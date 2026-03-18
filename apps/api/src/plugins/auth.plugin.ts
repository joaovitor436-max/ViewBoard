import fp from "fastify-plugin";
import { jwtVerify, type JWTPayload } from "jose";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { JwtPayload } from "@viewboard/shared";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user: JwtPayload;
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
        request.user = payload as unknown as JwtPayload;
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
});

export default authPlugin;
