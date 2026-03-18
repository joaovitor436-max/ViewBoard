import { z } from "zod";

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  zIndex: z.number().int().min(0).default(0),
  allowedContentTypes: z
    .array(
      z.enum([
        "IMAGE",
        "VIDEO",
        "HTML",
        "ANNOUNCEMENT",
        "NEWS_FEED",
        "WEATHER_WIDGET",
        "CLOCK",
        "TICKER",
      ])
    )
    .optional(),
});

export type Zone = z.infer<typeof ZoneSchema>;

export const LayoutSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
  name: z.string().min(1).max(255),
  zones: z.array(ZoneSchema),
  thumbnail: z.string().url().nullable().optional(),
});

export type Layout = z.infer<typeof LayoutSchema>;

export const CreateLayoutSchema = z.object({
  name: z.string().min(1).max(255),
  zones: z.array(ZoneSchema).min(1),
});

export type CreateLayout = z.infer<typeof CreateLayoutSchema>;

export const UpdateLayoutSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  zones: z.array(ZoneSchema).min(1).optional(),
});

export type UpdateLayout = z.infer<typeof UpdateLayoutSchema>;
