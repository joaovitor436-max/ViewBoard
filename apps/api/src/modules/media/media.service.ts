import type { PrismaClient, MediaType } from "@prisma/client";
import { randomUUID } from "crypto";
import { uploadFile, deleteFile, MINIO_BUCKET } from "../../lib/minio.js";
import { execFile } from "child_process";
import { writeFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const MINIO_PUBLIC_URL = `http://${process.env["MINIO_ENDPOINT"] ?? "localhost"}:${process.env["MINIO_PORT"] ?? "9000"}`;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB

export function validateMediaFile(
  mimetype: string,
  size: number
): { type: MediaType; error?: string } {
  if (ALLOWED_IMAGE_TYPES.includes(mimetype)) {
    if (size > MAX_IMAGE_SIZE) {
      return { type: "IMAGE", error: `Image exceeds max size of 10MB (got ${(size / 1024 / 1024).toFixed(1)}MB)` };
    }
    return { type: "IMAGE" };
  }

  if (ALLOWED_VIDEO_TYPES.includes(mimetype)) {
    if (size > MAX_VIDEO_SIZE) {
      return { type: "VIDEO", error: `Video exceeds max size of 500MB (got ${(size / 1024 / 1024).toFixed(1)}MB)` };
    }
    return { type: "VIDEO" };
  }

  return { type: "IMAGE", error: `Unsupported file type: ${mimetype}. Allowed: JPG, PNG, GIF, WEBP, MP4, WEBM` };
}

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });
}

export async function getVideoDuration(buffer: Buffer): Promise<number | null> {
  const tempDir = join(tmpdir(), "viewboard-media");
  await mkdir(tempDir, { recursive: true });
  const tempFile = join(tempDir, `${randomUUID()}.mp4`);

  try {
    await writeFile(tempFile, buffer);
    const output = await runCommand("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      tempFile,
    ]);
    const parsed = JSON.parse(output);
    const duration = parseFloat(parsed?.format?.duration);
    return isNaN(duration) ? null : Math.round(duration);
  } catch {
    // ffprobe not available — return null
    return null;
  } finally {
    try { await unlink(tempFile); } catch { /* ignore */ }
  }
}

export async function generateVideoThumbnail(
  buffer: Buffer,
  tenantId: string
): Promise<string | null> {
  const tempDir = join(tmpdir(), "viewboard-media");
  await mkdir(tempDir, { recursive: true });
  const tempFile = join(tempDir, `${randomUUID()}.mp4`);
  const thumbFile = join(tempDir, `${randomUUID()}.jpg`);

  try {
    await writeFile(tempFile, buffer);
    await runCommand("ffmpeg", [
      "-i", tempFile,
      "-ss", "00:00:01",
      "-vframes", "1",
      "-vf", "scale=320:-1",
      "-y",
      thumbFile,
    ]);

    const { readFile } = await import("fs/promises");
    const thumbBuffer = await readFile(thumbFile);
    const objectName = `${tenantId}/thumbs/${randomUUID()}.jpg`;
    const path = await uploadFile(objectName, thumbBuffer, "image/jpeg");
    return `${MINIO_PUBLIC_URL}${path}`;
  } catch {
    return null;
  } finally {
    try { await unlink(tempFile); } catch { /* ignore */ }
    try { await unlink(thumbFile); } catch { /* ignore */ }
  }
}

export async function uploadMedia(
  prisma: PrismaClient,
  tenantId: string,
  uploadedBy: string,
  file: { filename: string; mimetype: string; buffer: Buffer }
) {
  const size = file.buffer.length;
  const validation = validateMediaFile(file.mimetype, size);
  if (validation.error) {
    throw Object.assign(new Error(validation.error), {
      statusCode: 400,
      code: "INVALID_FILE",
    });
  }

  const ext = file.filename.split(".").pop() ?? "bin";
  const objectName = `${tenantId}/media/${randomUUID()}.${ext}`;

  const path = await uploadFile(objectName, file.buffer, file.mimetype);
  const url = `${MINIO_PUBLIC_URL}${path}`;

  let duration: number | null = null;
  let thumbnailUrl: string | null = null;

  if (validation.type === "VIDEO") {
    [duration, thumbnailUrl] = await Promise.all([
      getVideoDuration(file.buffer),
      generateVideoThumbnail(file.buffer, tenantId),
    ]);
  }

  // For images, the thumbnail is the image itself
  if (validation.type === "IMAGE") {
    thumbnailUrl = url;
  }

  const media = await prisma.media.create({
    data: {
      tenantId,
      uploadedBy,
      name: file.filename.replace(/\.[^/.]+$/, ""), // strip extension
      type: validation.type,
      url,
      thumbnailUrl,
      duration,
      sizeBytes: size,
    },
  });

  return media;
}

export async function listMedia(
  prisma: PrismaClient,
  tenantId: string,
  params: { page?: number; pageSize?: number; search?: string; type?: MediaType } = {}
) {
  const { page = 1, pageSize = 20, search, type } = params;
  const skip = (page - 1) * pageSize;

  const where = {
    tenantId,
    ...(type ? { type } : {}),
    ...(search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {}),
  };

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.media.count({ where }),
  ]);

  return { media, total, page, pageSize };
}

export async function getMediaById(
  prisma: PrismaClient,
  tenantId: string,
  mediaId: string
) {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, tenantId },
  });

  if (!media) {
    throw Object.assign(new Error("Media not found"), {
      statusCode: 404,
      code: "MEDIA_NOT_FOUND",
    });
  }

  return media;
}

export async function deleteMedia(
  prisma: PrismaClient,
  tenantId: string,
  mediaId: string
): Promise<void> {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, tenantId },
    include: { _count: { select: { playlistItems: true } } },
  });

  if (!media) {
    throw Object.assign(new Error("Media not found"), {
      statusCode: 404,
      code: "MEDIA_NOT_FOUND",
    });
  }

  if (media._count.playlistItems > 0) {
    throw Object.assign(new Error("Media is used in playlists. Remove from playlists first."), {
      statusCode: 409,
      code: "MEDIA_IN_USE",
    });
  }

  // Extract object name from URL to delete from MinIO
  const urlPath = new URL(media.url).pathname;
  const objectName = urlPath.replace(`/${MINIO_BUCKET}/`, "");

  try {
    await deleteFile(objectName);
  } catch {
    // File may already be deleted from storage
  }

  // Delete thumbnail if it's a separate file (not for images where thumb = original)
  if (media.thumbnailUrl && media.type === "VIDEO") {
    try {
      const thumbPath = new URL(media.thumbnailUrl).pathname;
      const thumbObject = thumbPath.replace(`/${MINIO_BUCKET}/`, "");
      await deleteFile(thumbObject);
    } catch { /* ignore */ }
  }

  await prisma.media.delete({ where: { id: mediaId } });
}
