import type { PrismaClient } from "@prisma/client";

export interface PlaylistItemInput {
  contentId?: string;
  mediaId?: string;
  zoneId?: string;
  order: number;
  durationSec?: number;
}

export interface CreatePlaylistInput {
  name: string;
  layoutId?: string;
  isDefault?: boolean;
  items?: PlaylistItemInput[];
}

export interface UpdatePlaylistInput {
  name?: string;
  layoutId?: string;
  isDefault?: boolean;
  isActive?: boolean;
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
        include: { content: true, media: true },
        orderBy: [{ order: "asc" }],
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
  // Verify layout belongs to tenant if provided
  if (input.layoutId) {
    const layout = await prisma.layout.findFirst({
      where: { id: input.layoutId, tenantId },
    });
    if (!layout) {
      throw Object.assign(new Error("Layout not found"), {
        statusCode: 404,
        code: "LAYOUT_NOT_FOUND",
      });
    }
  }

  if (input.isDefault) {
    await prisma.playlist.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const createData: Record<string, unknown> = {
    tenantId,
    name: input.name,
    layoutId: input.layoutId ?? null,
    isDefault: input.isDefault ?? false,
  };

  if (input.items) {
    createData.items = {
      create: input.items.map((item) => {
        const row: Record<string, unknown> = {
          contentId: item.contentId ?? null,
          mediaId: item.mediaId ?? null,
          zoneId: item.zoneId ?? "main",
          order: item.order,
        };
        if (item.durationSec !== undefined) row.durationSec = item.durationSec;
        return row;
      }),
    };
  }

  return prisma.playlist.create({
    data: createData as Parameters<typeof prisma.playlist.create>[0]["data"],
    include: {
      layout: true,
      items: { include: { content: true, media: true }, orderBy: { order: "asc" } },
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

  if (input.items !== undefined) {
    await prisma.playlistItem.deleteMany({ where: { playlistId } });
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.layoutId !== undefined) updateData.layoutId = input.layoutId;
  if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.items !== undefined) {
    updateData.items = {
      create: input.items.map((item) => {
        const row: Record<string, unknown> = {
          contentId: item.contentId ?? null,
          mediaId: item.mediaId ?? null,
          zoneId: item.zoneId ?? "main",
          order: item.order,
        };
        if (item.durationSec !== undefined) row.durationSec = item.durationSec;
        return row;
      }),
    };
  }

  return prisma.playlist.update({
    where: { id: playlistId },
    data: updateData as Parameters<typeof prisma.playlist.update>[0]["data"],
    include: {
      layout: true,
      items: { include: { content: true, media: true }, orderBy: { order: "asc" } },
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

  // Cascade delete handles items
  await prisma.playlist.delete({ where: { id: playlistId } });
}

// ── Playlist Items management ─────────────────────────────────────────

export async function addPlaylistItem(
  prisma: PrismaClient,
  tenantId: string,
  playlistId: string,
  input: { mediaId?: string; contentId?: string; order?: number; durationSec?: number }
) {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, tenantId },
    include: { items: { orderBy: { order: "desc" }, take: 1 } },
  });

  if (!playlist) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  // Validate media/content exists
  if (input.mediaId) {
    const media = await prisma.media.findFirst({
      where: { id: input.mediaId, tenantId },
    });
    if (!media) {
      throw Object.assign(new Error("Media not found"), {
        statusCode: 404,
        code: "MEDIA_NOT_FOUND",
      });
    }
  }

  const maxOrder = playlist.items[0]?.order ?? -1;
  const order = input.order ?? maxOrder + 1;

  return prisma.playlistItem.create({
    data: {
      playlistId,
      mediaId: input.mediaId ?? null,
      contentId: input.contentId ?? null,
      zoneId: "main",
      order,
      durationSec: input.durationSec ?? 10,
    },
    include: { media: true, content: true },
  });
}

export async function reorderPlaylistItems(
  prisma: PrismaClient,
  tenantId: string,
  playlistId: string,
  items: Array<{ itemId: string; order: number }>
) {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, tenantId },
  });

  if (!playlist) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.playlistItem.update({
        where: { id: item.itemId },
        data: { order: item.order },
      })
    )
  );

  return getPlaylistById(prisma, tenantId, playlistId);
}

export async function removePlaylistItem(
  prisma: PrismaClient,
  tenantId: string,
  playlistId: string,
  itemId: string
) {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, tenantId },
  });

  if (!playlist) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  const item = await prisma.playlistItem.findFirst({
    where: { id: itemId, playlistId },
  });

  if (!item) {
    throw Object.assign(new Error("Playlist item not found"), {
      statusCode: 404,
      code: "ITEM_NOT_FOUND",
    });
  }

  await prisma.playlistItem.delete({ where: { id: itemId } });
}

export async function getPlaylistPreview(
  prisma: PrismaClient,
  tenantId: string,
  playlistId: string
) {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, tenantId },
    include: {
      layout: true,
      items: {
        include: {
          media: { select: { id: true, name: true, type: true, url: true, thumbnailUrl: true, duration: true } },
          content: { select: { id: true, name: true, type: true, url: true, body: true, durationSec: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!playlist) {
    throw Object.assign(new Error("Playlist not found"), {
      statusCode: 404,
      code: "PLAYLIST_NOT_FOUND",
    });
  }

  // Build preview items with resolved URLs and durations
  const previewItems = playlist.items.map((item) => {
    if (item.media) {
      return {
        id: item.id,
        order: item.order,
        type: item.media.type as string,
        name: item.media.name,
        url: item.media.url,
        thumbnailUrl: item.media.thumbnailUrl,
        durationSec: item.durationSec ?? item.media.duration ?? 10,
      };
    }
    if (item.content) {
      return {
        id: item.id,
        order: item.order,
        type: item.content.type as string,
        name: item.content.name,
        url: item.content.url,
        body: item.content.body,
        durationSec: item.durationSec ?? item.content.durationSec ?? 10,
      };
    }
    return null;
  }).filter(Boolean);

  return {
    id: playlist.id,
    name: playlist.name,
    layout: playlist.layout,
    items: previewItems,
  };
}
