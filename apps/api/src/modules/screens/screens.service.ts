import type { PrismaClient } from "@prisma/client";
import { generatePairingCode, generateScreenSecretKey } from "../../lib/pairing.js";

export async function listScreens(
  prisma: PrismaClient,
  tenantId: string,
  params: { page?: number; pageSize?: number; search?: string } = {}
) {
  const { page = 1, pageSize = 20, search } = params;
  const skip = (page - 1) * pageSize;

  const where = {
    tenantId,
    ...(search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {}),
  };

  const [screens, total] = await Promise.all([
    prisma.screen.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        location: true,
        pairingCode: true,
        status: true,
        lastSeenAt: true,
        resolution: true,
        orientation: true,
        currentPlaylistId: true,
      },
    }),
    prisma.screen.count({ where }),
  ]);

  return { screens, total, page, pageSize };
}

export async function getScreenById(
  prisma: PrismaClient,
  tenantId: string,
  screenId: string
) {
  const screen = await prisma.screen.findFirst({
    where: { id: screenId, tenantId },
    include: {
      heartbeats: {
        orderBy: { timestamp: "desc" },
        take: 10,
      },
      schedules: {
        include: { schedule: { include: { playlist: true } } },
      },
    },
  });

  if (!screen) {
    throw Object.assign(new Error("Screen not found"), {
      statusCode: 404,
      code: "SCREEN_NOT_FOUND",
    });
  }

  return screen;
}

export async function createScreen(
  prisma: PrismaClient,
  tenantId: string,
  input: { name: string; location?: string; orientation?: "LANDSCAPE" | "PORTRAIT" }
) {
  const pairingCode = generatePairingCode();
  const secretKey = generateScreenSecretKey();

  const screen = await prisma.screen.create({
    data: {
      tenantId,
      name: input.name,
      location: input.location,
      pairingCode,
      secretKey,
      orientation: input.orientation ?? "LANDSCAPE",
    },
    select: {
      id: true,
      name: true,
      location: true,
      pairingCode: true,
      status: true,
      orientation: true,
    },
  });

  return screen;
}

export async function updateScreen(
  prisma: PrismaClient,
  tenantId: string,
  screenId: string,
  input: {
    name?: string;
    location?: string;
    orientation?: "LANDSCAPE" | "PORTRAIT";
    currentPlaylistId?: string;
  }
) {
  const existing = await prisma.screen.findFirst({
    where: { id: screenId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Screen not found"), {
      statusCode: 404,
      code: "SCREEN_NOT_FOUND",
    });
  }

  return prisma.screen.update({
    where: { id: screenId },
    data: input,
    select: {
      id: true,
      name: true,
      location: true,
      pairingCode: true,
      status: true,
      lastSeenAt: true,
      orientation: true,
      currentPlaylistId: true,
    },
  });
}

export async function deleteScreen(
  prisma: PrismaClient,
  tenantId: string,
  screenId: string
): Promise<void> {
  const existing = await prisma.screen.findFirst({
    where: { id: screenId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Screen not found"), {
      statusCode: 404,
      code: "SCREEN_NOT_FOUND",
    });
  }

  await prisma.screen.delete({ where: { id: screenId } });
}

export async function regeneratePairingCode(
  prisma: PrismaClient,
  tenantId: string,
  screenId: string
) {
  const existing = await prisma.screen.findFirst({
    where: { id: screenId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Screen not found"), {
      statusCode: 404,
      code: "SCREEN_NOT_FOUND",
    });
  }

  const pairingCode = generatePairingCode();
  const secretKey = generateScreenSecretKey();

  return prisma.screen.update({
    where: { id: screenId },
    data: { pairingCode, secretKey },
    select: { id: true, pairingCode: true },
  });
}
