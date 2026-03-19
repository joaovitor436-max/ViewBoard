import { randomBytes } from "crypto";
import type { PrismaClient, DeviceStatus } from "@prisma/client";
import { signAccessToken } from "../auth/auth.service.js";

/**
 * Generates a random 6-character uppercase alphanumeric pairing code.
 * Retries if the code already exists for the given tenant.
 */
export async function generateUniquePairingCode(
  prisma: PrismaClient,
  tenantId: string,
  maxAttempts = 10
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generatePairingCode6();
    const existing = await prisma.device.findUnique({
      where: { tenantId_pairingCode: { tenantId, pairingCode: code } },
    });
    if (!existing) return code;
  }
  throw Object.assign(new Error("Failed to generate unique pairing code"), {
    statusCode: 500,
    code: "PAIRING_CODE_GENERATION_FAILED",
  });
}

/**
 * Generates a random 6-char alphanumeric code (A-Z, 0-9).
 * Exported for testing.
 */
export function generatePairingCode6(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/1/0 to avoid confusion
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

export async function listDevices(
  prisma: PrismaClient,
  tenantId: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    groupId?: string;
    status?: DeviceStatus;
  } = {}
) {
  const { page = 1, pageSize = 20, search, groupId, status } = params;
  const skip = (page - 1) * pageSize;

  const where = {
    tenantId,
    ...(search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(groupId ? { groupId } : {}),
    ...(status ? { status } : {}),
  };

  const [devices, total] = await Promise.all([
    prisma.device.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { group: { select: { id: true, name: true } } },
    }),
    prisma.device.count({ where }),
  ]);

  return { devices, total, page, pageSize };
}

export async function getDeviceById(
  prisma: PrismaClient,
  tenantId: string,
  deviceId: string
) {
  const device = await prisma.device.findFirst({
    where: { id: deviceId, tenantId },
    include: { group: { select: { id: true, name: true } } },
  });

  if (!device) {
    throw Object.assign(new Error("Device not found"), {
      statusCode: 404,
      code: "DEVICE_NOT_FOUND",
    });
  }

  return device;
}

export async function createDevice(
  prisma: PrismaClient,
  tenantId: string,
  input: { name: string; location?: string; groupId?: string }
) {
  // Validate group belongs to tenant if provided
  if (input.groupId) {
    const group = await prisma.deviceGroup.findFirst({
      where: { id: input.groupId, tenantId },
    });
    if (!group) {
      throw Object.assign(new Error("Device group not found"), {
        statusCode: 404,
        code: "DEVICE_GROUP_NOT_FOUND",
      });
    }
  }

  const pairingCode = await generateUniquePairingCode(prisma, tenantId);

  return prisma.device.create({
    data: {
      tenantId,
      name: input.name,
      location: input.location,
      groupId: input.groupId,
      pairingCode,
      status: "PENDING",
    },
    include: { group: { select: { id: true, name: true } } },
  });
}

export async function updateDevice(
  prisma: PrismaClient,
  tenantId: string,
  deviceId: string,
  input: { name?: string; location?: string; groupId?: string | null }
) {
  const existing = await prisma.device.findFirst({
    where: { id: deviceId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Device not found"), {
      statusCode: 404,
      code: "DEVICE_NOT_FOUND",
    });
  }

  // Validate group if being changed
  if (input.groupId) {
    const group = await prisma.deviceGroup.findFirst({
      where: { id: input.groupId, tenantId },
    });
    if (!group) {
      throw Object.assign(new Error("Device group not found"), {
        statusCode: 404,
        code: "DEVICE_GROUP_NOT_FOUND",
      });
    }
  }

  return prisma.device.update({
    where: { id: deviceId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
    },
    include: { group: { select: { id: true, name: true } } },
  });
}

export async function deleteDevice(
  prisma: PrismaClient,
  tenantId: string,
  deviceId: string
): Promise<void> {
  const existing = await prisma.device.findFirst({
    where: { id: deviceId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Device not found"), {
      statusCode: 404,
      code: "DEVICE_NOT_FOUND",
    });
  }

  await prisma.device.delete({ where: { id: deviceId } });
}

export async function getDeviceStatus(
  prisma: PrismaClient,
  tenantId: string,
  deviceId: string
) {
  const device = await prisma.device.findFirst({
    where: { id: deviceId, tenantId },
    select: { id: true, status: true, lastSeenAt: true, name: true },
  });

  if (!device) {
    throw Object.assign(new Error("Device not found"), {
      statusCode: 404,
      code: "DEVICE_NOT_FOUND",
    });
  }

  return device;
}

/**
 * Public pairing: look up by pairingCode, return a limited-scope player token.
 */
export async function pairDevice(
  prisma: PrismaClient,
  pairingCode: string
) {
  const device = await prisma.device.findFirst({
    where: { pairingCode },
    include: { tenant: { select: { id: true, slug: true } } },
  });

  if (!device) {
    throw Object.assign(new Error("Invalid pairing code"), {
      statusCode: 404,
      code: "INVALID_PAIRING_CODE",
    });
  }

  // Mark device as ONLINE on first pair
  await prisma.device.update({
    where: { id: device.id },
    data: { status: "ONLINE", lastSeenAt: new Date() },
  });

  // Issue a player-scoped JWT (no role, no email — read-only scope)
  const playerToken = await signAccessToken({
    sub: device.id,
    tenantId: device.tenantId,
    deviceId: device.id,
    type: "player",
  });

  return {
    token: playerToken,
    device: {
      id: device.id,
      name: device.name,
      tenantId: device.tenantId,
      tenantSlug: device.tenant.slug,
    },
  };
}

/**
 * Heartbeat: update lastSeenAt and set status to ONLINE.
 */
export async function deviceHeartbeat(
  prisma: PrismaClient,
  deviceId: string
) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw Object.assign(new Error("Device not found"), {
      statusCode: 404,
      code: "DEVICE_NOT_FOUND",
    });
  }

  return prisma.device.update({
    where: { id: deviceId },
    data: { status: "ONLINE", lastSeenAt: new Date() },
    select: { id: true, status: true, lastSeenAt: true },
  });
}

/**
 * Marks all devices with lastSeenAt > threshold as OFFLINE.
 * Called by the cron job every 2 minutes.
 */
export async function markStaleDevicesOffline(
  prisma: PrismaClient,
  thresholdMinutes = 3
): Promise<number> {
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);

  const result = await prisma.device.updateMany({
    where: {
      status: "ONLINE",
      lastSeenAt: { lt: threshold },
    },
    data: { status: "OFFLINE" },
  });

  return result.count;
}
