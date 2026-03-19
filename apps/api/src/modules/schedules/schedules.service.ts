import type { PrismaClient, ScheduleRecurrence } from "@prisma/client";

// ── Tipos de entrada ────────────────────────────────────────────────────

export interface CreateScheduleInput {
  playlistId: string;
  name: string;
  startAt: string;        // ISO 8601
  endAt?: string;         // ISO 8601 (opcional para ONCE)
  recurrence?: ScheduleRecurrence;
  daysOfWeek?: number[];  // 0=Dom ... 6=Sab
  priority?: number;
  deviceId?: string;
  groupId?: string;
  screenIds?: string[];   // compatibilidade legacy com Screens
}

export interface UpdateScheduleInput {
  playlistId?: string;
  name?: string;
  startAt?: string;
  endAt?: string;
  recurrence?: ScheduleRecurrence;
  daysOfWeek?: number[];
  priority?: number;
  isActive?: boolean;
  deviceId?: string | null;
  groupId?: string | null;
  screenIds?: string[];
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function listSchedules(
  prisma: PrismaClient,
  tenantId: string,
  params: {
    page?: number;
    pageSize?: number;
    deviceId?: string;
    groupId?: string;
  } = {}
) {
  const { page = 1, pageSize = 20, deviceId, groupId } = params;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { tenantId };
  if (deviceId) where.deviceId = deviceId;
  if (groupId) where.groupId = groupId;

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ priority: "desc" }, { startAt: "asc" }],
      include: {
        playlist: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        screens: { include: { screen: { select: { id: true, name: true } } } },
      },
    }),
    prisma.schedule.count({ where }),
  ]);

  return { schedules, total, page, pageSize };
}

export async function getScheduleById(
  prisma: PrismaClient,
  tenantId: string,
  scheduleId: string
) {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, tenantId },
    include: {
      playlist: { select: { id: true, name: true } },
      device: { select: { id: true, name: true } },
      group: { select: { id: true, name: true, devices: { select: { id: true, name: true } } } },
      screens: { include: { screen: { select: { id: true, name: true } } } },
      logs: { orderBy: { executedAt: "desc" }, take: 50 },
    },
  });

  if (!schedule) {
    throw Object.assign(new Error("Agendamento não encontrado"), {
      statusCode: 404,
      code: "SCHEDULE_NOT_FOUND",
    });
  }

  return schedule;
}

export async function createSchedule(
  prisma: PrismaClient,
  tenantId: string,
  input: CreateScheduleInput
) {
  // Validar playlist
  const playlist = await prisma.playlist.findFirst({
    where: { id: input.playlistId, tenantId },
  });
  if (!playlist) {
    throw Object.assign(new Error("Playlist não encontrada"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  // Validar dispositivo
  if (input.deviceId) {
    const device = await prisma.device.findFirst({
      where: { id: input.deviceId, tenantId },
    });
    if (!device) {
      throw Object.assign(new Error("Dispositivo não encontrado"), {
        statusCode: 404,
        code: "DEVICE_NOT_FOUND",
      });
    }
  }

  // Validar grupo
  if (input.groupId) {
    const group = await prisma.deviceGroup.findFirst({
      where: { id: input.groupId, tenantId },
    });
    if (!group) {
      throw Object.assign(new Error("Grupo não encontrado"), {
        statusCode: 404,
        code: "GROUP_NOT_FOUND",
      });
    }
  }

  const data: Record<string, unknown> = {
    tenantId,
    playlistId: input.playlistId,
    name: input.name,
    startAt: new Date(input.startAt),
    endAt: input.endAt ? new Date(input.endAt) : null,
    recurrence: input.recurrence ?? "ONCE",
    daysOfWeek: input.daysOfWeek ?? [],
    priority: input.priority ?? 0,
    deviceId: input.deviceId ?? null,
    groupId: input.groupId ?? null,
  };

  if (input.screenIds && input.screenIds.length > 0) {
    data.screens = {
      create: input.screenIds.map((screenId: string) => ({ screenId })),
    };
  }

  return prisma.schedule.create({
    data: data as Parameters<typeof prisma.schedule.create>[0]["data"],
    include: {
      playlist: { select: { id: true, name: true } },
      device: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      screens: { include: { screen: { select: { id: true, name: true } } } },
    },
  });
}

export async function updateSchedule(
  prisma: PrismaClient,
  tenantId: string,
  scheduleId: string,
  input: UpdateScheduleInput
) {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Agendamento não encontrado"), {
      statusCode: 404,
      code: "SCHEDULE_NOT_FOUND",
    });
  }

  if (input.screenIds !== undefined) {
    await prisma.scheduleScreen.deleteMany({ where: { scheduleId } });
  }

  const data: Record<string, unknown> = {};
  if (input.playlistId !== undefined) data.playlistId = input.playlistId;
  if (input.name !== undefined) data.name = input.name;
  if (input.startAt !== undefined) data.startAt = new Date(input.startAt);
  if (input.endAt !== undefined) data.endAt = input.endAt ? new Date(input.endAt) : null;
  if (input.recurrence !== undefined) data.recurrence = input.recurrence;
  if (input.daysOfWeek !== undefined) data.daysOfWeek = input.daysOfWeek;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.deviceId !== undefined) data.deviceId = input.deviceId;
  if (input.groupId !== undefined) data.groupId = input.groupId;
  if (input.screenIds !== undefined) {
    data.screens = {
      create: input.screenIds.map((screenId: string) => ({ screenId })),
    };
  }

  return prisma.schedule.update({
    where: { id: scheduleId },
    data: data as Parameters<typeof prisma.schedule.update>[0]["data"],
    include: {
      playlist: { select: { id: true, name: true } },
      device: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      screens: { include: { screen: { select: { id: true, name: true } } } },
    },
  });
}

export async function deleteSchedule(
  prisma: PrismaClient,
  tenantId: string,
  scheduleId: string
): Promise<void> {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Agendamento não encontrado"), {
      statusCode: 404,
      code: "SCHEDULE_NOT_FOUND",
    });
  }

  await prisma.scheduleScreen.deleteMany({ where: { scheduleId } });
  await prisma.schedule.delete({ where: { id: scheduleId } });
}

// ── Calendário mensal ───────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  name: string;
  playlistName: string;
  startAt: string;
  endAt: string | null;
  recurrence: string;
  daysOfWeek: number[];
  priority: number;
  isActive: boolean;
  deviceName: string | null;
  groupName: string | null;
  color: string;
}

const PRIORITY_COLORS = [
  "#3b82f6", // 0 – azul (padrão)
  "#10b981", // 1 – verde
  "#f59e0b", // 2 – amarelo
  "#ef4444", // 3 – vermelho
  "#8b5cf6", // 4 – roxo
];

export async function getCalendarEvents(
  prisma: PrismaClient,
  tenantId: string,
  month: string // YYYY-MM
): Promise<CalendarEvent[]> {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr!, 10);
  const mon = parseInt(monthStr!, 10);

  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);

  const schedules = await prisma.schedule.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { recurrence: "ONCE", startAt: { gte: monthStart, lte: monthEnd } },
        { recurrence: { not: "ONCE" }, startAt: { lte: monthEnd } },
      ],
    },
    include: {
      playlist: { select: { name: true } },
      device: { select: { name: true } },
      group: { select: { name: true } },
    },
  });

  const events: CalendarEvent[] = [];

  for (const s of schedules) {
    const colorIdx = Math.min(s.priority, PRIORITY_COLORS.length - 1);
    const base = {
      id: s.id,
      name: s.name,
      playlistName: s.playlist.name,
      recurrence: s.recurrence,
      daysOfWeek: s.daysOfWeek,
      priority: s.priority,
      isActive: s.isActive,
      deviceName: s.device?.name ?? null,
      groupName: s.group?.name ?? null,
      color: PRIORITY_COLORS[colorIdx]!,
    };

    if (s.recurrence === "ONCE") {
      events.push({
        ...base,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt?.toISOString() ?? null,
      });
    } else {
      const occurrences = expandRecurrences(s, monthStart, monthEnd);
      for (const occ of occurrences) {
        events.push({
          ...base,
          startAt: occ.start.toISOString(),
          endAt: occ.end?.toISOString() ?? null,
        });
      }
    }
  }

  return events;
}

interface Occurrence {
  start: Date;
  end: Date | null;
}

function expandRecurrences(
  schedule: { startAt: Date; endAt: Date | null; recurrence: string; daysOfWeek: number[] },
  rangeStart: Date,
  rangeEnd: Date
): Occurrence[] {
  const results: Occurrence[] = [];
  const startHour = schedule.startAt.getHours();
  const startMin = schedule.startAt.getMinutes();
  const durationMs = schedule.endAt
    ? schedule.endAt.getTime() - schedule.startAt.getTime()
    : 0;

  const cursor = new Date(Math.max(schedule.startAt.getTime(), rangeStart.getTime()));
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= rangeEnd) {
    let include = false;

    if (schedule.recurrence === "DAILY") {
      include = true;
    } else if (schedule.recurrence === "WEEKLY" || schedule.recurrence === "CUSTOM") {
      include = schedule.daysOfWeek.length === 0 || schedule.daysOfWeek.includes(cursor.getDay());
    }

    if (include) {
      const occStart = new Date(cursor);
      occStart.setHours(startHour, startMin, 0, 0);
      if (occStart >= schedule.startAt && occStart <= rangeEnd) {
        results.push({
          start: occStart,
          end: durationMs ? new Date(occStart.getTime() + durationMs) : null,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

// ── Deteção de conflitos ────────────────────────────────────────────────

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    id: string;
    name: string;
    startAt: string;
    endAt: string | null;
    priority: number;
    playlistName: string;
  }>;
}

export async function checkConflicts(
  prisma: PrismaClient,
  tenantId: string,
  params: { deviceId: string; startAt: string; endAt: string; excludeId?: string }
): Promise<ConflictResult> {
  const start = new Date(params.startAt);
  const end = new Date(params.endAt);

  const baseWhere: Record<string, unknown> = {
    tenantId,
    isActive: true,
    startAt: { lt: end },
    OR: [{ endAt: null }, { endAt: { gt: start } }],
  };

  if (params.excludeId) {
    baseWhere.id = { not: params.excludeId };
  }

  // Agendamentos diretos para o dispositivo
  const directConflicts = await prisma.schedule.findMany({
    where: { ...baseWhere, deviceId: params.deviceId },
    include: { playlist: { select: { name: true } } },
    orderBy: { priority: "desc" },
  });

  // Agendamentos de grupo
  const device = await prisma.device.findFirst({
    where: { id: params.deviceId, tenantId },
    select: { groupId: true },
  });

  let groupConflicts: typeof directConflicts = [];
  if (device?.groupId) {
    groupConflicts = await prisma.schedule.findMany({
      where: { ...baseWhere, groupId: device.groupId },
      include: { playlist: { select: { name: true } } },
      orderBy: { priority: "desc" },
    });
  }

  const allConflicts = [...directConflicts, ...groupConflicts];

  return {
    hasConflict: allConflicts.length > 0,
    conflicts: allConflicts.map((s) => ({
      id: s.id,
      name: s.name,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt?.toISOString() ?? null,
      priority: s.priority,
      playlistName: s.playlist.name,
    })),
  };
}

// ── Logs ────────────────────────────────────────────────────────────────

export async function getScheduleLogs(
  prisma: PrismaClient,
  tenantId: string,
  params: {
    scheduleId?: string;
    deviceId?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const { page = 1, pageSize = 50, scheduleId, deviceId } = params;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {
    schedule: { tenantId },
  };
  if (scheduleId) where.scheduleId = scheduleId;
  if (deviceId) where.deviceId = deviceId;

  const [logs, total] = await Promise.all([
    prisma.scheduleLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { executedAt: "desc" },
      include: {
        schedule: { select: { id: true, name: true } },
      },
    }),
    prisma.scheduleLog.count({ where }),
  ]);

  return { logs, total, page, pageSize };
}

// ── Motor de resolução (usado pelo cron) ────────────────────────────────

export async function resolveActiveScheduleForDevice(
  prisma: PrismaClient,
  tenantId: string,
  deviceId: string,
  at: Date = new Date()
): Promise<{ scheduleId: string; playlistId: string } | null> {
  const device = await prisma.device.findFirst({
    where: { id: deviceId, tenantId },
    select: { groupId: true },
  });

  if (!device) return null;

  const orConditions: object[] = [{ deviceId }];
  if (device.groupId) {
    orConditions.push({ groupId: device.groupId });
  }

  const schedules = await prisma.schedule.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: orConditions,
    },
    orderBy: { priority: "desc" },
    select: {
      id: true,
      playlistId: true,
      startAt: true,
      endAt: true,
      recurrence: true,
      daysOfWeek: true,
      priority: true,
    },
  });

  const dayOfWeek = at.getDay();
  const nowMinutes = at.getHours() * 60 + at.getMinutes();

  for (const s of schedules) {
    if (s.recurrence === "ONCE") {
      if (at < s.startAt) continue;
      if (s.endAt && at > s.endAt) continue;
      return { scheduleId: s.id, playlistId: s.playlistId };
    }

    // Recorrente: verificar dia da semana
    if (s.recurrence === "WEEKLY" || s.recurrence === "CUSTOM") {
      if (s.daysOfWeek.length > 0 && !s.daysOfWeek.includes(dayOfWeek)) {
        continue;
      }
    }

    // Verificar janela horária
    const scheduleStartMinutes = s.startAt.getHours() * 60 + s.startAt.getMinutes();

    if (s.endAt) {
      const durationMinutes = Math.round((s.endAt.getTime() - s.startAt.getTime()) / 60000);
      const scheduleEndMinutes = scheduleStartMinutes + durationMinutes;
      if (nowMinutes >= scheduleStartMinutes && nowMinutes < scheduleEndMinutes) {
        return { scheduleId: s.id, playlistId: s.playlistId };
      }
    } else {
      if (nowMinutes >= scheduleStartMinutes) {
        return { scheduleId: s.id, playlistId: s.playlistId };
      }
    }
  }

  return null;
}

export async function getDefaultPlaylistId(
  prisma: PrismaClient,
  tenantId: string
): Promise<string | null> {
  const playlist = await prisma.playlist.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
    select: { id: true },
  });
  return playlist?.id ?? null;
}
