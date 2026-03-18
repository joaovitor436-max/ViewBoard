import type IORedis from "ioredis";
import type { WeatherData } from "@viewboard/shared";

const WEATHER_API_KEY = process.env["WEATHER_API_KEY"] ?? "";
const WEATHER_API_URL =
  process.env["WEATHER_API_URL"] ?? "https://api.openweathermap.org/data/2.5";
const CACHE_TTL_SECONDS = 600; // 10 minutes

interface OpenWeatherResponse {
  name: string;
  sys: { country: string };
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{ description: string; icon: string }>;
}

export async function getWeather(
  redis: IORedis,
  city: string,
  units: "metric" | "imperial" = "metric"
): Promise<WeatherData> {
  const cacheKey = `weather:${city}:${units}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached) as WeatherData;
  }

  if (!WEATHER_API_KEY) {
    // Return mock data when API key is not configured
    const mock: WeatherData = {
      temperature: 22,
      feelsLike: 20,
      humidity: 65,
      description: "Partly cloudy",
      icon: "02d",
      city,
      country: "BR",
      updatedAt: new Date().toISOString(),
    };
    await redis.setex(cacheKey, 60, JSON.stringify(mock));
    return mock;
  }

  const url = `${WEATHER_API_URL}/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${WEATHER_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw Object.assign(new Error(`Weather API error: ${response.status}`), {
      statusCode: 502,
      code: "WEATHER_API_ERROR",
    });
  }

  const data = (await response.json()) as OpenWeatherResponse;
  const weather: WeatherData = {
    temperature: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    description: data.weather[0]?.description ?? "",
    icon: data.weather[0]?.icon ?? "",
    city: data.name,
    country: data.sys.country,
    updatedAt: new Date().toISOString(),
  };

  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(weather));
  return weather;
}
