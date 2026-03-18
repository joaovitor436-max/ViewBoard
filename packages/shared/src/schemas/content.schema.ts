import { z } from "zod";

export const ContentTypeSchema = z.enum([
  "IMAGE",
  "VIDEO",
  "HTML",
  "ANNOUNCEMENT",
  "NEWS_FEED",
  "WEATHER_WIDGET",
  "CLOCK",
  "TICKER",
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ContentSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
  name: z.string().min(1).max(255),
  type: ContentTypeSchema,
  url: z.string().url().nullable().optional(),
  body: z.record(z.unknown()).nullable().optional(),
  durationSec: z.number().int().min(1).default(15),
  tags: z.array(z.string()),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Content = z.infer<typeof ContentSchema>;

export const CreateContentSchema = z.object({
  name: z.string().min(1).max(255),
  type: ContentTypeSchema,
  url: z.string().url().optional(),
  body: z.record(z.unknown()).optional(),
  durationSec: z.number().int().min(1).default(15),
  tags: z.array(z.string()).default([]),
});

export type CreateContent = z.infer<typeof CreateContentSchema>;

export const UpdateContentSchema = CreateContentSchema.partial();
export type UpdateContent = z.infer<typeof UpdateContentSchema>;
