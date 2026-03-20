import type { PrismaClient } from "@prisma/client";
import type IORedis from "ioredis";
import type {
  PlayerWidgetsPayload,
  WeatherWidgetConfig,
  NewsWidgetConfig,
} from "@viewboard/shared";
import { getWeather } from "../integrations/weather.service.js";
import { getTopHeadlines } from "../integrations/news.service.js";

export async function getPlayerWidgets(
  prisma: PrismaClient,
  redis: IORedis,
  tenantId: string
): Promise<PlayerWidgetsPayload> {
  const configs = await prisma.widgetConfig.findMany({
    where: { tenantId, isActive: true },
  });

  let weather = null;
  let news: PlayerWidgetsPayload["news"] = [];
  let weatherConfig: WeatherWidgetConfig | null = null;
  let newsConfig: NewsWidgetConfig | null = null;

  const weatherWidget = configs.find((c) => c.type === "WEATHER");
  const newsWidget = configs.find((c) => c.type === "NEWS");

  if (weatherWidget) {
    weatherConfig = weatherWidget.config as unknown as WeatherWidgetConfig;
    const units = weatherConfig.unit === "fahrenheit" ? "imperial" : "metric";
    const cacheTtl = (weatherConfig.updateIntervalMinutes ?? 10) * 60;
    try {
      weather = await getWeather(redis, weatherConfig.city, units, cacheTtl);
    } catch {
      // Graceful degradation: return null if weather API fails
      weather = null;
    }
  }

  if (newsWidget) {
    newsConfig = newsWidget.config as unknown as NewsWidgetConfig;
    const cacheTtl = (newsConfig.updateIntervalMinutes ?? 15) * 60;
    try {
      const newsOpts: {
        country?: string;
        category?: string;
        q?: string;
        pageSize?: number;
        sources?: string[];
        language?: string;
      } = {
        language: newsConfig.language,
        pageSize: newsConfig.maxItems ?? 10,
      };
      if (newsConfig.sources?.length) newsOpts.sources = newsConfig.sources;
      if (newsConfig.category) newsOpts.category = newsConfig.category;
      news = await getTopHeadlines(
        redis,
        newsOpts,
        cacheTtl
      );
    } catch {
      // Graceful degradation: return empty array if news API fails
      news = [];
    }
  }

  return { weather, news, weatherConfig, newsConfig };
}
