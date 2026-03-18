import type { PrismaClient, ContentType } from "@prisma/client";

export interface CreateContentInput {
  name: string;
  type: ContentType;
  url?: string;
  body?: Record<string, unknown>;
  durationSec?: number;
  tags?: string[];
}

export interface UpdateContentInput {
  name?: string;
  url?: string;
  body?: Record<string, unknown>;
  durationSec?: number;
  tags?: string[];
  isActive?: boolean;
}

export async function listContent(
  prisma: PrismaClient,
  tenantId: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: ContentType;
    tags?: string[];
  } = {}
) {
  const { page = 1, pageSize = 20, search, type, tags } = params;
  const skip = (page - 1) * pageSize;

  const where = {
    tenantId,
    isActive: true,
    ...(type ? { type } : {}),
    ...(tags && tags.length > 0 ? { tags: { hasSome: tags } } : {}),
    ...(search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {}),
  };

  const [content, total] = await Promise.all([
    prisma.content.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.content.count({ where }),
  ]);

  return { content, total, page, pageSize };
}

export async function getContentById(
  prisma: PrismaClient,
  tenantId: string,
  contentId: string
) {
  const content = await prisma.content.findFirst({
    where: { id: contentId, tenantId },
  });

  if (!content) {
    throw Object.assign(new Error("Content not found"), {
      statusCode: 404,
      code: "CONTENT_NOT_FOUND",
    });
  }

  return content;
}

export async function createContent(
  prisma: PrismaClient,
  tenantId: string,
  input: CreateContentInput
) {
  return prisma.content.create({
    data: {
      tenantId,
      name: input.name,
      type: input.type,
      url: input.url,
      body: input.body,
      durationSec: input.durationSec ?? 15,
      tags: input.tags ?? [],
    },
  });
}

export async function updateContent(
  prisma: PrismaClient,
  tenantId: string,
  contentId: string,
  input: UpdateContentInput
) {
  const existing = await prisma.content.findFirst({
    where: { id: contentId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Content not found"), {
      statusCode: 404,
      code: "CONTENT_NOT_FOUND",
    });
  }

  return prisma.content.update({
    where: { id: contentId },
    data: input,
  });
}

export async function deleteContent(
  prisma: PrismaClient,
  tenantId: string,
  contentId: string
): Promise<void> {
  const existing = await prisma.content.findFirst({
    where: { id: contentId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Content not found"), {
      statusCode: 404,
      code: "CONTENT_NOT_FOUND",
    });
  }

  // Soft delete
  await prisma.content.update({
    where: { id: contentId },
    data: { isActive: false },
  });
}
