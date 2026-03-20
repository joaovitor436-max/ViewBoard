import { z } from "zod";

// ── Templates disponíveis ────────────────────────────────────────────

export const LayoutTemplateEnum = z.enum([
  "FULLSCREEN",
  "SPLIT_BOTTOM",
  "SPLIT_SIDE",
  "GRID",
]);

export type LayoutTemplate = z.infer<typeof LayoutTemplateEnum>;

// ── Zona ─────────────────────────────────────────────────────────────

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  zIndex: z.number().int().min(0).default(0),
  role: z.enum(["media", "widget"]).default("media"),
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

// ── Widget de layout ─────────────────────────────────────────────────

export const LayoutWidgetSchema = z.object({
  type: z.enum(["clock", "weather", "news"]),
  enabled: z.boolean(),
});

export type LayoutWidget = z.infer<typeof LayoutWidgetSchema>;

// ── Config do layout ─────────────────────────────────────────────────

export const LayoutConfigSchema = z.object({
  backgroundColor: z.string().default("#000000"),
  logoUrl: z.string().nullable().default(null),
  widgets: z.array(LayoutWidgetSchema).default([
    { type: "clock", enabled: true },
    { type: "weather", enabled: false },
    { type: "news", enabled: false },
  ]),
  fontFamily: z.string().default("Inter, system-ui, sans-serif"),
  fontSize: z.number().min(8).max(72).default(16),
});

export type LayoutConfig = z.infer<typeof LayoutConfigSchema>;

// ── Layout completo ──────────────────────────────────────────────────

export const LayoutSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
  name: z.string().min(1).max(255),
  template: LayoutTemplateEnum,
  zones: z.array(ZoneSchema),
  config: LayoutConfigSchema,
  isDefault: z.boolean().default(false),
  createdAt: z.date().optional(),
});

export type Layout = z.infer<typeof LayoutSchema>;

// ── Schemas de criação/edição ────────────────────────────────────────

export const CreateLayoutSchema = z.object({
  name: z.string().min(1).max(255),
  template: LayoutTemplateEnum,
  config: LayoutConfigSchema.partial().optional(),
});

export type CreateLayout = z.infer<typeof CreateLayoutSchema>;

export const UpdateLayoutSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  template: LayoutTemplateEnum.optional(),
  config: LayoutConfigSchema.partial().optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateLayout = z.infer<typeof UpdateLayoutSchema>;

// ── Preview config (payload enviado ao player) ───────────────────────

export const LayoutPreviewConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  template: LayoutTemplateEnum,
  zones: z.array(ZoneSchema),
  config: LayoutConfigSchema,
});

export type LayoutPreviewConfig = z.infer<typeof LayoutPreviewConfigSchema>;
