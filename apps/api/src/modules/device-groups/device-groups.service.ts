import type { PrismaClient } from "@prisma/client";

export async function listDeviceGroups(
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

  const [groups, total] = await Promise.all([
    prisma.deviceGroup.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      include: { _count: { select: { devices: true } } },
    }),
    prisma.deviceGroup.count({ where }),
  ]);

  return { groups, total, page, pageSize };
}

export async function getDeviceGroupById(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string
) {
  const group = await prisma.deviceGroup.findFirst({
    where: { id: groupId, tenantId },
    include: { _count: { select: { devices: true } } },
  });

  if (!group) {
    throw Object.assign(new Error("Device group not found"), {
      statusCode: 404,
      code: "DEVICE_GROUP_NOT_FOUND",
    });
  }

  return group;
}

export async function createDeviceGroup(
  prisma: PrismaClient,
  tenantId: string,
  input: { name: string; description?: string }
) {
  return prisma.deviceGroup.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description,
    },
    include: { _count: { select: { devices: true } } },
  });
}

export async function updateDeviceGroup(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  input: { name?: string; description?: string }
) {
  const existing = await prisma.deviceGroup.findFirst({
    where: { id: groupId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Device group not found"), {
      statusCode: 404,
      code: "DEVICE_GROUP_NOT_FOUND",
    });
  }

  return prisma.deviceGroup.update({
    where: { id: groupId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
    include: { _count: { select: { devices: true } } },
  });
}

export async function deleteDeviceGroup(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string
): Promise<void> {
  const existing = await prisma.deviceGroup.findFirst({
    where: { id: groupId, tenantId },
    include: { _count: { select: { devices: true } } },
  });

  if (!existing) {
    throw Object.assign(new Error("Device group not found"), {
      statusCode: 404,
      code: "DEVICE_GROUP_NOT_FOUND",
    });
  }

  if (existing._count.devices > 0) {
    throw Object.assign(
      new Error("Cannot delete group with devices. Move or remove them first."),
      { statusCode: 409, code: "GROUP_NOT_EMPTY" }
    );
  }

  await prisma.deviceGroup.delete({ where: { id: groupId } });
}

export async function listDevicesByGroup(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  params: { page?: number; pageSize?: number } = {}
) {
  const { page = 1, pageSize = 20 } = params;
  const skip = (page - 1) * pageSize;

  // Verify group belongs to tenant
  const group = await prisma.deviceGroup.findFirst({
    where: { id: groupId, tenantId },
  });

  if (!group) {
    throw Object.assign(new Error("Device group not found"), {
      statusCode: 404,
      code: "DEVICE_GROUP_NOT_FOUND",
    });
  }

  const where = { tenantId, groupId };

  const [devices, total] = await Promise.all([
    prisma.device.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.device.count({ where }),
  ]);

  return { devices, total, page, pageSize };
}
