import type IORedis from "ioredis";
import type { WeatherData, WeatherForecastItem } from "@viewboard/shared";

const WEATHER_API_KEY = process.env["WEATHER_API_KEY"] ?? "";
const WEATHER_API_URL =
  process.env["WEATHER_API_URL"] ?? "https://api.openweathermap.org/data/2.5";

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

interface ForecastEntry {
  dt_txt: string;
  main: { temp: number };
  weather: Array<{ description: string; icon: string }>;
}

interface OpenWeatherForecastResponse {
  list: ForecastEntry[];
}

export async function getWeather(
  redis: IORedis,
  city: string,
  units: "metric" | "imperial" = "metric",
  cacheTtlSeconds: number = 600
): Promise<WeatherData> {
  const cacheKey = `weather:${city}:${units}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached) as WeatherData;
  }

  if (!WEATHER_API_KEY) {
    const mock: WeatherData = {
      temperature: 22,
      feelsLike: 20,
      humidity: 65,
      description: "Partly cloudy",
      icon: "02d",
      city,
      country: "BR",
      updatedAt: new Date().toISOString(),
      forecast: [
        { time: "+1h", temperature: 23, description: "Partly cloudy", icon: "02d" },
        { time: "+2h", temperature: 24, description: "Sunny", icon: "01d" },
        { time: "+3h", temperature: 23, description: "Partly cloudy", icon: "02d" },
      ],
    };
    await redis.setex(cacheKey, 60, JSON.stringify(mock));
    return mock;
  }

  const currentUrl = `${WEATHER_API_URL}/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${WEATHER_API_KEY}&lang=pt`;
  const forecastUrl = `${WEATHER_API_URL}/forecast?q=${encodeURIComponent(city)}&units=${units}&appid=${WEATHER_API_KEY}&lang=pt&cnt=3`;

  const [currentRes, forecastRes] = await Promise.all([
    fetch(currentUrl),
    fetch(forecastUrl),
  ]);

  if (!currentRes.ok) {
    throw Object.assign(new Error(`Weather API error: ${currentRes.status}`), {
      statusCode: 502,
      code: "WEATHER_API_ERROR",
    });
  }

  const data = (await currentRes.json()) as OpenWeatherResponse;

  let forecast: WeatherForecastItem[] = [];
  if (forecastRes.ok) {
    const forecastData = (await forecastRes.json()) as OpenWeatherForecastResponse;
    forecast = forecastData.list.map((entry) => ({
      time: entry.dt_txt,
      temperature: Math.round(entry.main.temp),
      description: entry.weather[0]?.description ?? "",
      icon: entry.weather[0]?.icon ?? "",
    }));
  }

  const weather: WeatherData = {
    temperature: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    description: data.weather[0]?.description ?? "",
    icon: data.weather[0]?.icon ?? "",
    city: data.name,
    country: data.sys.country,
    updatedAt: new Date().toISOString(),
    forecast,
  };

  await redis.setex(cacheKey, cacheTtlSeconds, JSON.stringify(weather));
  return weather;
}
