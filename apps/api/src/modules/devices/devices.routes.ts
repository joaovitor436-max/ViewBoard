import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  getDeviceStatus,
  pairDevice,
  deviceHeartbeat,
} from "./devices.service.js";

const CreateDeviceBody = z.object({
  name: z.string().min(1).max(255),
  location: z.string().max(500).optional(),
  groupId: z.string().optional(),
});

const UpdateDeviceBody = z.object({
  name: z.string().min(1).max(255).optional(),
  location: z.string().max(500).optional(),
  groupId: z.string().nullable().optional(),
});

const PairDeviceBody = z.object({
  pairingCode: z.string().length(6),
});

const devicesRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Public endpoints (no auth) ──────────────────────────────────────

  // POST /devices/pair — public, returns player token
  fastify.post("/devices/pair", async (request, reply) => {
    const parsed = PairDeviceBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const result = await pairDevice(fastify.prisma, parsed.data.pairingCode);
      return reply.status(200).send({ data: result });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // PUT /devices/heartbeat — authenticated with player token
  fastify.put(
    "/devices/heartbeat",
    { preHandler: [fastify.authenticatePlayer] },
    async (request, reply) => {
      try {
        const result = await deviceHeartbeat(
          fastify.prisma,
          request.player.deviceId
        );
        return reply.send({ data: result });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message: string };
        return reply
          .status(e.statusCode ?? 500)
          .send({ error: e.message, code: e.code });
      }
    }
  );

  // ── Authenticated endpoints ─────────────────────────────────────────

  // All routes below require admin/user JWT
  fastify.register(async (authenticated) => {
    authenticated.addHook("preHandler", fastify.authenticate);

    // GET /devices
    authenticated.get("/devices", async (request, reply) => {
      const query = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        groupId?: string;
        status?: string;
      };
      const result = await listDevices(fastify.prisma, request.user.tenantId, {
        page: query.page ? parseInt(query.page, 10) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
        search: query.search,
        groupId: query.groupId,
        status: query.status as "ONLINE" | "OFFLINE" | "PENDING" | undefined,
      });
      return reply.send({
        data: result.devices,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        },
      });
    });

    // POST /devices
    authenticated.post("/devices", async (request, reply) => {
      const parsed = CreateDeviceBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
        });
      }
      try {
        const device = await createDevice(
          fastify.prisma,
          request.user.tenantId,
          parsed.data
        );
        return reply.status(201).send({ data: device });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message: string };
        return reply
          .status(e.statusCode ?? 500)
          .send({ error: e.message, code: e.code });
      }
    });

    // PATCH /devices/:id
    authenticated.patch("/devices/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateDeviceBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
        });
      }
      try {
        const device = await updateDevice(
          fastify.prisma,
          request.user.tenantId,
          id,
          parsed.data
        );
        return reply.send({ data: device });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message: string };
        return reply
          .status(e.statusCode ?? 500)
          .send({ error: e.message, code: e.code });
      }
    });

    // DELETE /devices/:id
    authenticated.delete("/devices/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await deleteDevice(fastify.prisma, request.user.tenantId, id);
        return reply.status(204).send();
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message: string };
        return reply
          .status(e.statusCode ?? 500)
          .send({ error: e.message, code: e.code });
      }
    });

    // GET /devices/:id/status
    authenticated.get("/devices/:id/status", async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const status = await getDeviceStatus(
          fastify.prisma,
          request.user.tenantId,
          id
        );
        return reply.send({ data: status });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message: string };
        return reply
          .status(e.statusCode ?? 500)
          .send({ error: e.message, code: e.code });
      }
    });
  });
};

export default devicesRoutes;
