import { useState, useEffect, useCallback, useRef } from "react";
import { usePlayerStore } from "@/store/playerStore";

interface WeatherForecastItem {
  time: string;
  temperature: number;
  description: string;
  icon: string;
}

interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  city: string;
  country: string;
  updatedAt: string;
  forecast?: WeatherForecastItem[];
}

interface NewsItem {
  title: string;
  description?: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  timeAgo?: string;
}

interface WeatherWidgetConfig {
  city: string;
  unit: "celsius" | "fahrenheit";
  updateIntervalMinutes: number;
}

interface NewsWidgetConfig {
  sources: string[];
  category?: string;
  language: string;
  maxItems: number;
  updateIntervalMinutes: number;
}

interface PlayerWidgetsPayload {
  weather: WeatherData | null;
  news: NewsItem[];
  weatherConfig: WeatherWidgetConfig | null;
  newsConfig: NewsWidgetConfig | null;
}

const API_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001";

export function useWidgets() {
  const { screenToken } = usePlayerStore();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [weatherConfig, setWeatherConfig] = useState<WeatherWidgetConfig | null>(null);
  const [newsConfig, setNewsConfig] = useState<NewsWidgetConfig | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWidgets = useCallback(async () => {
    if (!screenToken) return;

    try {
      const res = await fetch(`${API_URL}/api/v1/player/widgets`, {
        headers: { Authorization: `Bearer ${screenToken}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      const payload = data.data as PlayerWidgetsPayload;

      setWeather(payload.weather);
      setNews(payload.news);
      setWeatherConfig(payload.weatherConfig);
      setNewsConfig(payload.newsConfig);
    } catch {
      // Graceful degradation — keep existing data
    }
  }, [screenToken]);

  useEffect(() => {
    fetchWidgets();

    // Use the shortest configured interval
    const weatherInterval = weatherConfig?.updateIntervalMinutes ?? 10;
    const newsInterval = newsConfig?.updateIntervalMinutes ?? 15;
    const minInterval = Math.min(weatherInterval, newsInterval) * 60 * 1000;

    intervalRef.current = setInterval(fetchWidgets, minInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchWidgets, weatherConfig?.updateIntervalMinutes, newsConfig?.updateIntervalMinutes]);

  return { weather, news, weatherConfig, newsConfig, refetch: fetchWidgets };
}

export type { WeatherData, NewsItem, WeatherWidgetConfig, NewsWidgetConfig };
