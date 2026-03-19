import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listDeviceGroups,
  getDeviceGroupById,
  createDeviceGroup,
  updateDeviceGroup,
  deleteDeviceGroup,
  listDevicesByGroup,
} from "./device-groups.service.js";

const CreateGroupBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

const UpdateGroupBody = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

const deviceGroupsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /device-groups
  fastify.get("/device-groups", async (request, reply) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      search?: string;
    };
    const result = await listDeviceGroups(
      fastify.prisma,
      request.user.tenantId,
      {
        page: query.page ? parseInt(query.page, 10) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
        search: query.search,
      }
    );
    return reply.send({
      data: result.groups,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    });
  });

  // GET /device-groups/:id
  fastify.get("/device-groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const group = await getDeviceGroupById(
        fastify.prisma,
        request.user.tenantId,
        id
      );
      return reply.send({ data: group });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // POST /device-groups
  fastify.post("/device-groups", async (request, reply) => {
    const parsed = CreateGroupBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const group = await createDeviceGroup(
        fastify.prisma,
        request.user.tenantId,
        parsed.data
      );
      return reply.status(201).send({ data: group });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // PATCH /device-groups/:id
  fastify.patch("/device-groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateGroupBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const group = await updateDeviceGroup(
        fastify.prisma,
        request.user.tenantId,
        id,
        parsed.data
      );
      return reply.send({ data: group });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // DELETE /device-groups/:id
  fastify.delete("/device-groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteDeviceGroup(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // GET /device-groups/:id/devices
  fastify.get("/device-groups/:id/devices", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { page?: string; pageSize?: string };
    try {
      const result = await listDevicesByGroup(
        fastify.prisma,
        request.user.tenantId,
        id,
        {
          page: query.page ? parseInt(query.page, 10) : 1,
          pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
        }
      );
      return reply.send({
        data: result.devices,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        },
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default deviceGroupsRoutes;
