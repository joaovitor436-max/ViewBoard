import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getCalendarEvents,
  checkConflicts,
  getScheduleLogs,
  type CreateScheduleInput,
  type UpdateScheduleInput,
} from "./schedules.service.js";

const RecurrenceEnum = z.enum(["ONCE", "DAILY", "WEEKLY", "CUSTOM"]);

const CreateScheduleBody = z.object({
  playlistId: z.string().min(1),
  name: z.string().min(1).max(255),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  recurrence: RecurrenceEnum.optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  priority: z.number().int().min(0).default(0),
  deviceId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  screenIds: z.array(z.string().min(1)).optional(),
});

const UpdateScheduleBody = z.object({
  playlistId: z.string().min(1).optional(),
  name: z.string().min(1).max(255).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  recurrence: RecurrenceEnum.optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  deviceId: z.string().min(1).nullable().optional(),
  groupId: z.string().min(1).nullable().optional(),
  screenIds: z.array(z.string().min(1)).optional(),
});

const schedulesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /schedules — listar com filtros
  fastify.get("/schedules", async (request, reply) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      deviceId?: string;
      groupId?: string;
    };
    const result = await listSchedules(fastify.prisma, request.user.tenantId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
      deviceId: query.deviceId,
      groupId: query.groupId,
    });
    return reply.send({
      data: result.schedules,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  });

  // GET /schedules/calendar?month=YYYY-MM — eventos do calendário
  fastify.get("/schedules/calendar", async (request, reply) => {
    const query = request.query as { month?: string };
    if (!query.month || !/^\d{4}-\d{2}$/.test(query.month)) {
      return reply.status(400).send({
        error: "Parâmetro month obrigatório no formato YYYY-MM",
        code: "VALIDATION_ERROR",
      });
    }
    const events = await getCalendarEvents(
      fastify.prisma,
      request.user.tenantId,
      query.month
    );
    return reply.send({ data: events });
  });

  // GET /schedules/conflicts?deviceId=&startAt=&endAt= — verificar conflitos
  fastify.get("/schedules/conflicts", async (request, reply) => {
    const query = request.query as {
      deviceId?: string;
      startAt?: string;
      endAt?: string;
      excludeId?: string;
    };
    if (!query.deviceId || !query.startAt || !query.endAt) {
      return reply.status(400).send({
        error: "Parâmetros deviceId, startAt e endAt são obrigatórios",
        code: "VALIDATION_ERROR",
      });
    }
    const result = await checkConflicts(
      fastify.prisma,
      request.user.tenantId,
      {
        deviceId: query.deviceId,
        startAt: query.startAt,
        endAt: query.endAt,
        excludeId: query.excludeId,
      }
    );
    return reply.send({ data: result });
  });

  // GET /schedules/logs — histórico de execuções
  fastify.get("/schedules/logs", async (request, reply) => {
    const query = request.query as {
      scheduleId?: string;
      deviceId?: string;
      page?: string;
      pageSize?: string;
    };
    const result = await getScheduleLogs(
      fastify.prisma,
      request.user.tenantId,
      {
        scheduleId: query.scheduleId,
        deviceId: query.deviceId,
        page: query.page ? parseInt(query.page, 10) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 50,
      }
    );
    return reply.send({
      data: result.logs,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  });

  // GET /schedules/:id
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

  // POST /schedules
  fastify.post("/schedules", async (request, reply) => {
    const parsed = CreateScheduleBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validação falhou",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const input: CreateScheduleInput = {
        playlistId: parsed.data.playlistId,
        name: parsed.data.name,
        startAt: parsed.data.startAt,
      };
      if (parsed.data.endAt) input.endAt = parsed.data.endAt;
      if (parsed.data.recurrence) input.recurrence = parsed.data.recurrence;
      if (parsed.data.daysOfWeek) input.daysOfWeek = parsed.data.daysOfWeek;
      if (parsed.data.priority !== undefined) input.priority = parsed.data.priority;
      if (parsed.data.deviceId) input.deviceId = parsed.data.deviceId;
      if (parsed.data.groupId) input.groupId = parsed.data.groupId;
      if (parsed.data.screenIds) input.screenIds = parsed.data.screenIds;

      const schedule = await createSchedule(
        fastify.prisma,
        request.user.tenantId,
        input
      );
      return reply.status(201).send({ data: schedule });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // PATCH /schedules/:id
  fastify.patch("/schedules/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateScheduleBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validação falhou",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }
    try {
      const schedule = await updateSchedule(
        fastify.prisma,
        request.user.tenantId,
        id,
        parsed.data as UpdateScheduleInput
      );
      return reply.send({ data: schedule });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message: string };
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: e.message, code: e.code });
    }
  });

  // DELETE /schedules/:id
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
