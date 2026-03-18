import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "./schedules.service.js";

const RecurrenceSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  interval: z.number().int().min(1).optional(),
  byDay: z
    .array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]))
    .optional(),
  until: z.string().datetime().optional(),
  count: z.number().int().min(1).optional(),
});

const CreateScheduleBody = z.object({
  playlistId: z.string().cuid(),
  name: z.string().min(1).max(255),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  recurrence: RecurrenceSchema.optional(),
  priority: z.number().int().min(0).default(0),
  screenIds: z.array(z.string().cuid()).min(1),
});

const UpdateScheduleBody = z.object({
  playlistId: z.string().cuid().optional(),
  name: z.string().min(1).max(255).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  recurrence: RecurrenceSchema.optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  screenIds: z.array(z.string().cuid()).min(1).optional(),
});

const schedulesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/schedules", async (request, reply) => {
    const query = request.query as { page?: string; pageSize?: string };
    const result = await listSchedules(fastify.prisma, request.user.tenantId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    });
    return reply.send({
      data: result.schedules,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  });

  fastify.get("/schedules/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const schedule = await getScheduleById(
        fastify.prisma,
        request.user.tenantId,
        id
      );
      return reply.send({ data: schedule });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.post("/schedules", async (request, reply) => {
    const parsed = CreateScheduleBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const schedule = await createSchedule(
        fastify.prisma,
        request.user.tenantId,
        parsed.data
      );
      return reply.status(201).send({ data: schedule });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.patch("/schedules/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateScheduleBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const schedule = await updateSchedule(
        fastify.prisma,
        request.user.tenantId,
        id,
        parsed.data
      );
      return reply.send({ data: schedule });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  fastify.delete("/schedules/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteSchedule(fastify.prisma, request.user.tenantId, id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });
};

export default schedulesRoutes;
