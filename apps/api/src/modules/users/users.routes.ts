import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "./users.service.js";

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
  role: z
    .enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"])
    .optional(),
});

const UpdateUserBody = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(1).max(255).optional(),
  role: z
    .enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"])
    .optional(),
  isActive: z.boolean().optional(),
});

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/users", async (request, reply) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      search?: string;
    };
    const result = await listUsers(fastify.prisma, request.user.tenantId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
      search: query.search,
    });
    return reply.send({
      data: result.users,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    });
  });

  fastify.get("/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const user = await getUserById(fastify.prisma, request.user.tenantId, id);
      return reply.send({ data: user });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.post("/users", async (request, reply) => {
    const parsed = CreateUserBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const user = await createUser(
        fastify.prisma,
        request.user.tenantId,
        parsed.data
      );
      return reply.status(201).send({ data: user });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.patch("/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateUserBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const user = await updateUser(
        fastify.prisma,
        request.user.tenantId,
        id,
        parsed.data
      );
      return reply.send({ data: user });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.delete("/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteUser(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default usersRoutes;
