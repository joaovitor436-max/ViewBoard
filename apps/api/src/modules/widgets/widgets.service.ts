import type { PrismaClient, WidgetType } from "@prisma/client";
import type {
  WidgetConfigResponse,
  WeatherWidgetConfig,
  NewsWidgetConfig,
} from "@viewboard/shared";

const DEFAULT_WEATHER_CONFIG: WeatherWidgetConfig = {
  city: "São Paulo",
  unit: "celsius",
  updateIntervalMinutes: 10,
};

const DEFAULT_NEWS_CONFIG: NewsWidgetConfig = {
  sources: [],
  category: "general",
  language: "pt",
  maxItems: 10,
  updateIntervalMinutes: 15,
};

function toResponse(record: {
  id: string;
  tenantId: string;
  type: WidgetType;
  config: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WidgetConfigResponse {
  return {
    id: record.id,
    tenantId: record.tenantId,
    type: record.type as "NEWS" | "WEATHER",
    config: record.config as WeatherWidgetConfig | NewsWidgetConfig,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listWidgetConfigs(
  prisma: PrismaClient,
  tenantId: string
): Promise<WidgetConfigResponse[]> {
  const configs = await prisma.widgetConfig.findMany({
    where: { tenantId },
    orderBy: { type: "asc" },
  });
  return configs.map(toResponse);
}

export async function getWidgetConfig(
  prisma: PrismaClient,
  tenantId: string,
  type: "NEWS" | "WEATHER"
): Promise<WidgetConfigResponse | null> {
  const config = await prisma.widgetConfig.findUnique({
    where: { tenantId_type: { tenantId, type } },
  });
  return config ? toResponse(config) : null;
}

export async function createWidgetConfig(
  prisma: PrismaClient,
  tenantId: string,
  data: {
    type: "NEWS" | "WEATHER";
    config?: Partial<WeatherWidgetConfig> | Partial<NewsWidgetConfig>;
    isActive?: boolean;
  }
): Promise<WidgetConfigResponse> {
  const existing = await prisma.widgetConfig.findUnique({
    where: { tenantId_type: { tenantId, type: data.type } },
  });

  if (existing) {
    throw Object.assign(new Error("Widget config already exists for this type"), {
      statusCode: 409,
      code: "WIDGET_CONFIG_EXISTS",
    });
  }

  const defaultConfig =
    data.type === "WEATHER" ? DEFAULT_WEATHER_CONFIG : DEFAULT_NEWS_CONFIG;

  const config = await prisma.widgetConfig.create({
    data: {
      tenantId,
      type: data.type,
      config: { ...defaultConfig, ...data.config } as object,
      isActive: data.isActive ?? true,
    },
  });

  return toResponse(config);
}

export async function updateWidgetConfig(
  prisma: PrismaClient,
  tenantId: string,
  id: string,
  data: {
    config?: Partial<WeatherWidgetConfig> | Partial<NewsWidgetConfig>;
    isActive?: boolean;
  }
): Promise<WidgetConfigResponse> {
  const existing = await prisma.widgetConfig.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Widget config not found"), {
      statusCode: 404,
      code: "WIDGET_CONFIG_NOT_FOUND",
    });
  }

  const mergedConfig = data.config
    ? { ...(existing.config as object), ...data.config }
    : undefined;

  const updated = await prisma.widgetConfig.update({
    where: { id },
    data: {
      ...(mergedConfig ? { config: mergedConfig as object } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  return toResponse(updated);
}

export async function deleteWidgetConfig(
  prisma: PrismaClient,
  tenantId: string,
  id: string
): Promise<void> {
  const existing = await prisma.widgetConfig.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Widget config not found"), {
      statusCode: 404,
      code: "WIDGET_CONFIG_NOT_FOUND",
    });
  }

  await prisma.widgetConfig.delete({ where: { id } });
}
