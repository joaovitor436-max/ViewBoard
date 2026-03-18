import type { PrismaClient } from "@prisma/client";

export async function getDashboardStats(
  prisma: PrismaClient,
  tenantId: string
) {
  const [
    totalScreens,
    onlineScreens,
    offlineScreens,
    errorScreens,
    totalContent,
    totalPlaylists,
    totalSchedules,
    recentHeartbeats,
  ] = await Promise.all([
    prisma.screen.count({ where: { tenantId } }),
    prisma.screen.count({ where: { tenantId, status: "ONLINE" } }),
    prisma.screen.count({ where: { tenantId, status: "OFFLINE" } }),
    prisma.screen.count({ where: { tenantId, status: "ERROR" } }),
    prisma.content.count({ where: { tenantId, isActive: true } }),
    prisma.playlist.count({ where: { tenantId } }),
    prisma.schedule.count({ where: { tenantId, isActive: true } }),
    prisma.screenHeartbeat.findMany({
      where: {
        screen: { tenantId },
        timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { timestamp: "desc" },
      take: 100,
      include: { screen: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    screens: {
      total: totalScreens,
      online: onlineScreens,
      offline: offlineScreens,
      error: errorScreens,
    },
    content: { total: totalContent },
    playlists: { total: totalPlaylists },
    schedules: { active: totalSchedules },
    recentHeartbeats,
  };
}

export async function getScreenTimeline(
  prisma: PrismaClient,
  tenantId: string,
  screenId: string,
  from: Date,
  to: Date
) {
  const screen = await prisma.screen.findFirst({
    where: { id: screenId, tenantId },
  });

  if (!screen) {
    throw Object.assign(new Error("Screen not found"), {
      statusCode: 404,
      code: "SCREEN_NOT_FOUND",
    });
  }

  const heartbeats = await prisma.screenHeartbeat.findMany({
    where: {
      screenId,
      timestamp: { gte: from, lte: to },
    },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, metadata: true },
  });

  // Group heartbeats into 5-minute buckets
  const buckets: Record<string, number> = {};
  for (const hb of heartbeats) {
    const bucket = new Date(
      Math.floor(hb.timestamp.getTime() / (5 * 60 * 1000)) * 5 * 60 * 1000
    ).toISOString();
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
  }

  return {
    screenId,
    from: from.toISOString(),
    to: to.toISOString(),
    buckets: Object.entries(buckets).map(([timestamp, count]) => ({
      timestamp,
      count,
    })),
    totalHeartbeats: heartbeats.length,
  };
}

export async function getOnlineScreens(
  prisma: PrismaClient,
  tenantId: string
) {
  return prisma.screen.findMany({
    where: { tenantId, status: "ONLINE" },
    select: {
      id: true,
      name: true,
      location: true,
      lastSeenAt: true,
      currentPlaylistId: true,
      orientation: true,
      resolution: true,
    },
    orderBy: { name: "asc" },
  });
}
