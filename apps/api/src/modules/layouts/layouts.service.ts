import type { PrismaClient } from "@prisma/client";
import type { Zone } from "@viewboard/shared";

export interface CreateLayoutInput {
  name: string;
  zones: Zone[];
}

export interface UpdateLayoutInput {
  name?: string;
  zones?: Zone[];
}

export async function listLayouts(
  prisma: PrismaClient,
  tenantId: string
) {
  return prisma.layout.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { playlists: true } },
    },
  });
}

export async function getLayoutById(
  prisma: PrismaClient,
  tenantId: string,
  layoutId: string
) {
  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, tenantId },
    include: {
      playlists: { select: { id: true, name: true } },
    },
  });

  if (!layout) {
    throw Object.assign(new Error("Layout not found"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  return layout;
}

export async function createLayout(
  prisma: PrismaClient,
  tenantId: string,
  input: CreateLayoutInput
) {
  return prisma.layout.create({
    data: {
      tenantId,
      name: input.name,
      zones: input.zones as object[],
    },
  });
}

export async function updateLayout(
  prisma: PrismaClient,
  tenantId: string,
  layoutId: string,
  input: UpdateLayoutInput
) {
  const existing = await prisma.layout.findFirst({
    where: { id: layoutId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Layout not found"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  return prisma.layout.update({
    where: { id: layoutId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.zones !== undefined ? { zones: input.zones as object[] } : {}),
    },
  });
}

export async function deleteLayout(
  prisma: PrismaClient,
  tenantId: string,
  layoutId: string
): Promise<void> {
  const existing = await prisma.layout.findFirst({
    where: { id: layoutId, tenantId },
    include: { _count: { select: { playlists: true } } },
  });

  if (!existing) {
    throw Object.assign(new Error("Layout not found"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  if (existing._count.playlists > 0) {
    throw Object.assign(
      new Error("Cannot delete layout with associated playlists"),
      { statusCode: 409, code: "LAYOUT_IN_USE" }
    );
  }

  await prisma.layout.delete({ where: { id: layoutId } });
}
