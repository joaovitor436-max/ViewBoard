import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveActiveScheduleForDevice,
  getDefaultPlaylistId,
  checkConflicts,
  getCalendarEvents,
} from "../modules/schedules/schedules.service.js";

// ── Mock helpers ──────────────────────────────────────────────────────

interface MockSchedule {
  id: string;
  playlistId: string;
  name: string;
  tenantId: string;
  startAt: Date;
  endAt: Date | null;
  recurrence: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
  daysOfWeek: number[];
  priority: number;
  isActive: boolean;
  deviceId: string | null;
  groupId: string | null;
  playlist: { name: string };
  device?: { name: string } | null;
  group?: { name: string } | null;
}

function createMockPrisma({
  schedules = [] as MockSchedule[],
  device = { groupId: null } as { groupId: string | null } | null,
  defaultPlaylist = null as { id: string } | null,
} = {}) {
  return {
    device: {
      findFirst: vi.fn(async () => device),
      findMany: vi.fn(async () => []),
    },
    schedule: {
      findMany: vi.fn(async () => schedules),
      count: vi.fn(async () => schedules.length),
    },
    playlist: {
      findFirst: vi.fn(async () => defaultPlaylist),
    },
    scheduleLog: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
  };
}

function makeSchedule(overrides: Partial<MockSchedule> = {}): MockSchedule {
  return {
    id: "sched-1",
    playlistId: "playlist-1",
    name: "Test Schedule",
    tenantId: "tenant-1",
    startAt: new Date("2026-03-19T10:00:00Z"),
    endAt: new Date("2026-03-19T12:00:00Z"),
    recurrence: "ONCE",
    daysOfWeek: [],
    priority: 0,
    isActive: true,
    deviceId: "device-1",
    groupId: null,
    playlist: { name: "Promo Playlist" },
    device: { name: "Lobby TV" },
    group: null,
    ...overrides,
  };
}

// ── resolveActiveScheduleForDevice ────────────────────────────────────

describe("resolveActiveScheduleForDevice", () => {
  it("devolve null se o dispositivo não existe", async () => {
    const prisma = createMockPrisma({ device: null });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-inexistente"
    );

    expect(result).toBeNull();
  });

  it("devolve null se não há agendamentos ativos", async () => {
    const prisma = createMockPrisma({ schedules: [] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T11:00:00Z")
    );

    expect(result).toBeNull();
  });

  it("resolve agendamento ONCE dentro da janela temporal", async () => {
    const sched = makeSchedule({
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T10:00:00Z"),
      endAt: new Date("2026-03-19T12:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T11:00:00Z")
    );

    expect(result).toEqual({
      scheduleId: "sched-1",
      playlistId: "playlist-1",
    });
  });

  it("ignora agendamento ONCE fora da janela temporal (antes do início)", async () => {
    const sched = makeSchedule({
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T14:00:00Z"),
      endAt: new Date("2026-03-19T16:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T10:00:00Z")
    );

    expect(result).toBeNull();
  });

  it("ignora agendamento ONCE fora da janela temporal (após o fim)", async () => {
    const sched = makeSchedule({
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T10:00:00Z"),
      endAt: new Date("2026-03-19T12:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T13:00:00Z")
    );

    expect(result).toBeNull();
  });

  it("resolve o agendamento com maior prioridade quando há sobreposição", async () => {
    const lowPriority = makeSchedule({
      id: "sched-low",
      playlistId: "playlist-low",
      priority: 1,
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T10:00:00Z"),
      endAt: new Date("2026-03-19T14:00:00Z"),
    });
    const highPriority = makeSchedule({
      id: "sched-high",
      playlistId: "playlist-high",
      priority: 5,
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T11:00:00Z"),
      endAt: new Date("2026-03-19T13:00:00Z"),
    });

    // Prisma retorna ordenado por prioridade DESC
    const prisma = createMockPrisma({
      schedules: [highPriority, lowPriority],
    });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T12:00:00Z")
    );

    expect(result).toEqual({
      scheduleId: "sched-high",
      playlistId: "playlist-high",
    });
  });

  it("resolve agendamento DAILY dentro da janela horária", async () => {
    const sched = makeSchedule({
      recurrence: "DAILY",
      startAt: new Date("2026-03-01T09:00:00Z"),
      endAt: new Date("2026-03-01T11:00:00Z"), // 2h de duração
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    // Testar num dia diferente mas dentro da janela horária
    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T10:30:00Z") // 10:30 está entre 09:00-11:00
    );

    expect(result).toEqual({
      scheduleId: "sched-1",
      playlistId: "playlist-1",
    });
  });

  it("ignora agendamento DAILY fora da janela horária", async () => {
    const sched = makeSchedule({
      recurrence: "DAILY",
      startAt: new Date("2026-03-01T09:00:00Z"),
      endAt: new Date("2026-03-01T11:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T15:00:00Z") // 15:00 fora da janela 09:00-11:00
    );

    expect(result).toBeNull();
  });

  it("resolve agendamento WEEKLY no dia correto da semana", async () => {
    // 2026-03-19 é quinta-feira (dia 4)
    const sched = makeSchedule({
      recurrence: "WEEKLY",
      daysOfWeek: [4], // quinta
      startAt: new Date("2026-03-05T08:00:00Z"),
      endAt: new Date("2026-03-05T10:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T09:00:00Z") // quinta, 09:00
    );

    expect(result).toEqual({
      scheduleId: "sched-1",
      playlistId: "playlist-1",
    });
  });

  it("ignora agendamento WEEKLY no dia errado da semana", async () => {
    // 2026-03-19 é quinta-feira (dia 4)
    const sched = makeSchedule({
      recurrence: "WEEKLY",
      daysOfWeek: [1, 3], // segunda e quarta
      startAt: new Date("2026-03-03T08:00:00Z"),
      endAt: new Date("2026-03-03T10:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T09:00:00Z") // quinta - não está na lista
    );

    expect(result).toBeNull();
  });

  it("resolve agendamento CUSTOM com dias específicos", async () => {
    // 2026-03-20 é sexta-feira (dia 5)
    const sched = makeSchedule({
      recurrence: "CUSTOM",
      daysOfWeek: [1, 3, 5], // seg, qua, sex
      startAt: new Date("2026-03-02T12:00:00Z"),
      endAt: new Date("2026-03-02T14:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-20T13:00:00Z") // sexta, 13:00
    );

    expect(result).toEqual({
      scheduleId: "sched-1",
      playlistId: "playlist-1",
    });
  });

  it("resolve agendamento de grupo quando o dispositivo pertence ao grupo", async () => {
    const sched = makeSchedule({
      deviceId: null,
      groupId: "group-1",
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T10:00:00Z"),
      endAt: new Date("2026-03-19T18:00:00Z"),
    });
    const prisma = createMockPrisma({
      schedules: [sched],
      device: { groupId: "group-1" },
    });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T12:00:00Z")
    );

    expect(result).toEqual({
      scheduleId: "sched-1",
      playlistId: "playlist-1",
    });
  });

  it("agendamento de dispositivo tem precedência sobre agendamento de grupo (mesma prioridade)", async () => {
    const groupSched = makeSchedule({
      id: "sched-group",
      playlistId: "playlist-group",
      deviceId: null,
      groupId: "group-1",
      priority: 5,
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T10:00:00Z"),
      endAt: new Date("2026-03-19T18:00:00Z"),
    });
    const deviceSched = makeSchedule({
      id: "sched-device",
      playlistId: "playlist-device",
      deviceId: "device-1",
      groupId: null,
      priority: 5,
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T10:00:00Z"),
      endAt: new Date("2026-03-19T18:00:00Z"),
    });

    // Prisma retorna por prioridade; em empate, a ordem importa
    const prisma = createMockPrisma({
      schedules: [deviceSched, groupSched],
      device: { groupId: "group-1" },
    });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T12:00:00Z")
    );

    expect(result).toEqual({
      scheduleId: "sched-device",
      playlistId: "playlist-device",
    });
  });

  it("resolve agendamento sem endAt (aberto) para ONCE", async () => {
    const sched = makeSchedule({
      recurrence: "ONCE",
      startAt: new Date("2026-03-19T08:00:00Z"),
      endAt: null, // sem fim definido
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T23:00:00Z") // muito depois do início
    );

    expect(result).toEqual({
      scheduleId: "sched-1",
      playlistId: "playlist-1",
    });
  });

  it("resolve agendamento DAILY sem endAt (a partir da hora de início)", async () => {
    const sched = makeSchedule({
      recurrence: "DAILY",
      startAt: new Date("2026-03-01T14:00:00Z"),
      endAt: null,
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    // Depois da hora de início
    const result = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T16:00:00Z")
    );
    expect(result).not.toBeNull();

    // Antes da hora de início
    const result2 = await resolveActiveScheduleForDevice(
      prisma as unknown as Parameters<typeof resolveActiveScheduleForDevice>[0],
      "tenant-1",
      "device-1",
      new Date("2026-03-19T10:00:00Z")
    );
    expect(result2).toBeNull();
  });
});

// ── getDefaultPlaylistId ──────────────────────────────────────────────

describe("getDefaultPlaylistId", () => {
  it("devolve o ID da playlist padrão", async () => {
    const prisma = createMockPrisma({
      defaultPlaylist: { id: "default-pl" },
    });

    const result = await getDefaultPlaylistId(
      prisma as unknown as Parameters<typeof getDefaultPlaylistId>[0],
      "tenant-1"
    );

    expect(result).toBe("default-pl");
  });

  it("devolve null se não há playlist padrão", async () => {
    const prisma = createMockPrisma({ defaultPlaylist: null });

    const result = await getDefaultPlaylistId(
      prisma as unknown as Parameters<typeof getDefaultPlaylistId>[0],
      "tenant-1"
    );

    expect(result).toBeNull();
  });
});

// ── checkConflicts ────────────────────────────────────────────────────

describe("checkConflicts", () => {
  it("deteta conflitos diretos para o dispositivo", async () => {
    const conflicting = makeSchedule({
      id: "conflict-1",
      name: "Existing Schedule",
    });
    const prisma = createMockPrisma({
      schedules: [conflicting],
    });
    // findMany é chamado duas vezes: diretos + grupo
    (prisma.schedule.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([conflicting]) // diretos
      .mockResolvedValueOnce([]);           // grupo

    const result = await checkConflicts(
      prisma as unknown as Parameters<typeof checkConflicts>[0],
      "tenant-1",
      {
        deviceId: "device-1",
        startAt: "2026-03-19T10:30:00Z",
        endAt: "2026-03-19T11:30:00Z",
      }
    );

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.id).toBe("conflict-1");
    expect(result.conflicts[0]!.name).toBe("Existing Schedule");
  });

  it("deteta conflitos de grupo", async () => {
    const groupConflict = makeSchedule({
      id: "group-conflict",
      name: "Group Schedule",
      groupId: "group-1",
      deviceId: null,
    });
    const prisma = createMockPrisma({
      device: { groupId: "group-1" },
    });
    (prisma.schedule.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])            // diretos
      .mockResolvedValueOnce([groupConflict]); // grupo

    const result = await checkConflicts(
      prisma as unknown as Parameters<typeof checkConflicts>[0],
      "tenant-1",
      {
        deviceId: "device-1",
        startAt: "2026-03-19T10:00:00Z",
        endAt: "2026-03-19T12:00:00Z",
      }
    );

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.name).toBe("Group Schedule");
  });

  it("sem conflitos quando não há sobreposição", async () => {
    const prisma = createMockPrisma();
    (prisma.schedule.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await checkConflicts(
      prisma as unknown as Parameters<typeof checkConflicts>[0],
      "tenant-1",
      {
        deviceId: "device-1",
        startAt: "2026-03-19T20:00:00Z",
        endAt: "2026-03-19T22:00:00Z",
      }
    );

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it("exclui o próprio agendamento ao verificar conflitos (edição)", async () => {
    const prisma = createMockPrisma();
    (prisma.schedule.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await checkConflicts(
      prisma as unknown as Parameters<typeof checkConflicts>[0],
      "tenant-1",
      {
        deviceId: "device-1",
        startAt: "2026-03-19T10:00:00Z",
        endAt: "2026-03-19T12:00:00Z",
        excludeId: "sched-being-edited",
      }
    );

    // Verificar que o excludeId foi passado na query
    const firstCall = (prisma.schedule.findMany as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      where: { id?: { not: string } };
    };
    expect(firstCall.where.id).toEqual({ not: "sched-being-edited" });
  });
});

// ── getCalendarEvents ─────────────────────────────────────────────────

describe("getCalendarEvents", () => {
  it("retorna eventos ONCE dentro do mês", async () => {
    const sched = makeSchedule({
      recurrence: "ONCE",
      startAt: new Date("2026-03-15T10:00:00Z"),
      endAt: new Date("2026-03-15T12:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const events = await getCalendarEvents(
      prisma as unknown as Parameters<typeof getCalendarEvents>[0],
      "tenant-1",
      "2026-03"
    );

    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe("Test Schedule");
    expect(events[0]!.startAt).toBe("2026-03-15T10:00:00.000Z");
    expect(events[0]!.playlistName).toBe("Promo Playlist");
  });

  it("expande recorrência DAILY em múltiplos eventos no mês", async () => {
    const sched = makeSchedule({
      recurrence: "DAILY",
      startAt: new Date("2026-03-01T09:00:00Z"),
      endAt: new Date("2026-03-01T11:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const events = await getCalendarEvents(
      prisma as unknown as Parameters<typeof getCalendarEvents>[0],
      "tenant-1",
      "2026-03"
    );

    // DAILY a partir de 1 de março = 31 eventos (um por dia)
    expect(events.length).toBe(31);
    // Todos devem ter a mesma hora
    for (const evt of events) {
      const d = new Date(evt.startAt);
      expect(d.getUTCHours()).toBe(9);
      expect(d.getUTCMinutes()).toBe(0);
    }
  });

  it("expande recorrência WEEKLY apenas nos dias corretos", async () => {
    // Seg e Qua
    const sched = makeSchedule({
      recurrence: "WEEKLY",
      daysOfWeek: [1, 3], // segunda e quarta
      startAt: new Date("2026-03-02T10:00:00Z"), // segunda
      endAt: new Date("2026-03-02T12:00:00Z"),
    });
    const prisma = createMockPrisma({ schedules: [sched] });

    const events = await getCalendarEvents(
      prisma as unknown as Parameters<typeof getCalendarEvents>[0],
      "tenant-1",
      "2026-03"
    );

    // Em março de 2026: segundas = 2,9,16,23,30; quartas = 4,11,18,25 = 9 dias
    expect(events.length).toBe(9);
    for (const evt of events) {
      const d = new Date(evt.startAt);
      expect([1, 3]).toContain(d.getUTCDay());
    }
  });

  it("aplica cor baseada na prioridade", async () => {
    const sched = makeSchedule({ priority: 3 }); // vermelho
    const prisma = createMockPrisma({ schedules: [sched] });

    const events = await getCalendarEvents(
      prisma as unknown as Parameters<typeof getCalendarEvents>[0],
      "tenant-1",
      "2026-03"
    );

    expect(events[0]!.color).toBe("#ef4444"); // vermelho
  });
});
