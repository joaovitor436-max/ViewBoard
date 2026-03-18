import type { PrismaClient } from "@prisma/client";

export interface PlaylistItemInput {
  contentId: string;
  zoneId: string;
  order: number;
  durationSec?: number;
}

export interface CreatePlaylistInput {
  name: string;
  layoutId: string;
  isDefault?: boolean;
  items?: PlaylistItemInput[];
}

export interface UpdatePlaylistInput {
  name?: string;
  layoutId?: string;
  isDefault?: boolean;
  items?: PlaylistItemInput[];
}

export async function listPlaylists(
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

  const [playlists, total] = await Promise.all([
    prisma.playlist.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        layout: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.playlist.count({ where }),
  ]);

  return { playlists, total, page, pageSize };
}

export async function getPlaylistById(
  prisma: PrismaClient,
  tenantId: string,
  playlistId: string
) {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, tenantId },
    include: {
      layout: true,
      items: {
        include: { content: true },
        orderBy: [{ zoneId: "asc" }, { order: "asc" }],
      },
    },
  });

  if (!playlist) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  return playlist;
}

export async function createPlaylist(
  prisma: PrismaClient,
  tenantId: string,
  input: CreatePlaylistInput
) {
  // Verify layout belongs to tenant
  const layout = await prisma.layout.findFirst({
    where: { id: input.layoutId, tenantId },
  });

  if (!layout) {
    throw Object.assign(new Error("Layout not found"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  // If isDefault is being set, unset other defaults first
  if (input.isDefault) {
    await prisma.playlist.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.playlist.create({
    data: {
      tenantId,
      name: input.name,
      layoutId: input.layoutId,
      isDefault: input.isDefault ?? false,
      items: input.items
        ? {
            create: input.items.map((item) => ({
              contentId: item.contentId,
              zoneId: item.zoneId,
              order: item.order,
              durationSec: item.durationSec,
            })),
          }
        : undefined,
    },
    include: {
      layout: true,
      items: { include: { content: true }, orderBy: { order: "asc" } },
    },
  });
}

export async function updatePlaylist(
  prisma: PrismaClient,
  tenantId: string,
  playlistId: string,
  input: UpdatePlaylistInput
) {
  const existing = await prisma.playlist.findFirst({
    where: { id: playlistId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  if (input.isDefault) {
    await prisma.playlist.updateMany({
      where: { tenantId, isDefault: true, id: { not: playlistId } },
      data: { isDefault: false },
    });
  }

  // Replace items if provided
  if (input.items !== undefined) {
    await prisma.playlistItem.deleteMany({ where: { playlistId } });
  }

  return prisma.playlist.update({
    where: { id: playlistId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.layoutId !== undefined ? { layoutId: input.layoutId } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.items !== undefined
        ? {
            items: {
              create: input.items.map((item) => ({
                contentId: item.contentId,
                zoneId: item.zoneId,
                order: item.order,
                durationSec: item.durationSec,
              })),
            },
          }
        : {}),
    },
    include: {
      layout: true,
      items: { include: { content: true }, orderBy: { order: "asc" } },
    },
  });
}

export async function deletePlaylist(
  prisma: PrismaClient,
  tenantId: string,
  playlistId: string
): Promise<void> {
  const existing = await prisma.playlist.findFirst({
    where: { id: playlistId, tenantId },
    include: { _count: { select: { schedules: true } } },
  });

  if (!existing) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  if (existing._count.schedules > 0) {
    throw Object.assign(
      new Error("Cannot delete playlist with active schedules"),
      { statusCode: 409, code: "PLAYLIST_IN_USE" }
    );
  }

  // Delete items first
  await prisma.playlistItem.deleteMany({ where: { playlistId } });
  await prisma.playlist.delete({ where: { id: playlistId } });
}
