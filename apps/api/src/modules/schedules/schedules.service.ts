import type { PrismaClient } from "@prisma/client";
import { RRule } from "rrule";

export interface RecurrenceInput {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval?: number;
  byDay?: string[];
  until?: string;
  count?: number;
}

export interface CreateScheduleInput {
  playlistId: string;
  name: string;
  startAt: string;
  endAt: string;
  recurrence?: RecurrenceInput;
  priority?: number;
  screenIds: string[];
}

export interface UpdateScheduleInput {
  playlistId?: string;
  name?: string;
  startAt?: string;
  endAt?: string;
  recurrence?: RecurrenceInput;
  priority?: number;
  isActive?: boolean;
  screenIds?: string[];
}

function buildRRule(startAt: Date, recurrence: RecurrenceInput): RRule {
  const freqMap: Record<string, number> = {
    DAILY: RRule.DAILY,
    WEEKLY: RRule.WEEKLY,
    MONTHLY: RRule.MONTHLY,
  };

  const dayMap: Record<string, import("rrule").Weekday> = {
    MO: RRule.MO,
    TU: RRule.TU,
    WE: RRule.WE,
    TH: RRule.TH,
    FR: RRule.FR,
    SA: RRule.SA,
    SU: RRule.SU,
  };

  return new RRule({
    freq: freqMap[recurrence.freq] as number,
    interval: recurrence.interval ?? 1,
    dtstart: startAt,
    until: recurrence.until ? new Date(recurrence.until) : undefined,
    count: recurrence.count,
    byweekday: recurrence.byDay
      ? recurrence.byDay.map((d) => dayMap[d] as import("rrule").Weekday)
      : undefined,
  });
}

export async function listSchedules(
  prisma: PrismaClient,
  tenantId: string,
  params: { page?: number; pageSize?: number } = {}
) {
  const { page = 1, pageSize = 20 } = params;
  const skip = (page - 1) * pageSize;

  const [schedules, total] = await Promise.all([
    prisma.schedule.findMany({
      where: { tenantId },
      skip,
      take: pageSize,
      orderBy: [{ priority: "desc" }, { startAt: "asc" }],
      include: {
        playlist: { select: { id: true, name: true } },
        screens: { include: { screen: { select: { id: true, name: true } } } },
      },
    }),
    prisma.schedule.count({ where: { tenantId } }),
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
      playlist: {
        include: {
          items: { include: { content: true }, orderBy: { order: "asc" } },
          layout: true,
        },
      },
      screens: { include: { screen: true } },
    },
  });

  if (!schedule) {
    throw Object.assign(new Error("Schedule not found"), {
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
  const playlist = await prisma.playlist.findFirst({
    where: { id: input.playlistId, tenantId },
  });

  if (!playlist) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  // Validate screens belong to tenant
  const screens = await prisma.screen.findMany({
    where: { id: { in: input.screenIds }, tenantId },
    select: { id: true },
  });

  if (screens.length !== input.screenIds.length) {
    throw Object.assign(new Error("One or more screens not found"), {
      statusCode: 404,
      code: "SCREENS_NOT_FOUND",
    });
  }

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  // Validate rrule if recurrence provided
  if (input.recurrence) {
    buildRRule(startAt, input.recurrence); // throws if invalid
  }

  return prisma.schedule.create({
    data: {
      tenantId,
      playlistId: input.playlistId,
      name: input.name,
      startAt,
      endAt,
      recurrence: input.recurrence ?? null,
      priority: input.priority ?? 0,
      screens: {
        create: input.screenIds.map((screenId) => ({ screenId })),
      },
    },
    include: {
      playlist: { select: { id: true, name: true } },
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
    throw Object.assign(new Error("Schedule not found"), {
      statusCode: 404,
      code: "SCHEDULE_NOT_FOUND",
    });
  }

  if (input.screenIds !== undefined) {
    await prisma.scheduleScreen.deleteMany({ where: { scheduleId } });
  }

  return prisma.schedule.update({
    where: { id: scheduleId },
    data: {
      ...(input.playlistId ? { playlistId: input.playlistId } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.startAt ? { startAt: new Date(input.startAt) } : {}),
      ...(input.endAt ? { endAt: new Date(input.endAt) } : {}),
      ...(input.recurrence !== undefined
        ? { recurrence: input.recurrence ?? null }
        : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.screenIds !== undefined
        ? {
            screens: {
              create: input.screenIds.map((screenId) => ({ screenId })),
            },
          }
        : {}),
    },
    include: {
      playlist: { select: { id: true, name: true } },
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
    throw Object.assign(new Error("Schedule not found"), {
      statusCode: 404,
      code: "SCHEDULE_NOT_FOUND",
    });
  }

  await prisma.scheduleScreen.deleteMany({ where: { scheduleId } });
  await prisma.schedule.delete({ where: { id: scheduleId } });
}

/**
 * Resolves the active playlist for a screen at a given time.
 * Picks the highest-priority schedule whose time window contains `at`.
 */
export async function resolveActivePlaylist(
  prisma: PrismaClient,
  tenantId: string,
  screenId: string,
  at: Date = new Date()
) {
  const schedules = await prisma.schedule.findMany({
    where: {
      tenantId,
      isActive: true,
      screens: { some: { screenId } },
      startAt: { lte: at },
      endAt: { gte: at },
    },
    orderBy: { priority: "desc" },
    include: {
      playlist: {
        include: {
          items: { include: { content: true }, orderBy: { order: "asc" } },
          layout: true,
        },
      },
    },
  });

  // Filter by recurrence
  for (const schedule of schedules) {
    if (!schedule.recurrence) {
      return schedule.playlist;
    }

    // Has recurrence - check if `at` falls within an occurrence
    const rec = schedule.recurrence as {
      freq: string;
      interval?: number;
      byDay?: string[];
      until?: string;
      count?: number;
    };
    const rule = buildRRule(schedule.startAt, {
      freq: rec.freq as RecurrenceInput["freq"],
      interval: rec.interval,
      byDay: rec.byDay,
      until: rec.until,
      count: rec.count,
    });

    const durationMs = schedule.endAt.getTime() - schedule.startAt.getTime();

    // Get occurrences around the current time
    const occurrences = rule.between(
      new Date(at.getTime() - durationMs),
      at,
      true
    );

    if (occurrences.length > 0) {
      const lastOccurrence = occurrences[occurrences.length - 1] as Date;
      const occurrenceEnd = new Date(lastOccurrence.getTime() + durationMs);
      if (at >= lastOccurrence && at <= occurrenceEnd) {
        return schedule.playlist;
      }
    }
  }

  return null;
}
