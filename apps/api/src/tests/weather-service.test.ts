import { describe, it, expect, vi, beforeEach } from "vitest";
import IORedis from "ioredis";
import { getWeather } from "../modules/integrations/weather.service.js";

// Mock Redis
function createMockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
    }),
    _store: store,
  } as unknown as IORedis;
}

// Mock fetch globally
const mockFetch = vi.fn();

describe("getWeather", () => {
  let redis: IORedis;

  beforeEach(() => {
    redis = createMockRedis();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("should return cached data when available", async () => {
    const cached = {
      temperature: 25,
      feelsLike: 23,
      humidity: 70,
      description: "clear sky",
      icon: "01d",
      city: "São Paulo",
      country: "BR",
      updatedAt: "2024-01-01T00:00:00.000Z",
      forecast: [],
    };

    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      JSON.stringify(cached)
    );

    const result = await getWeather(redis, "São Paulo", "metric");

    expect(result).toEqual(cached);
    expect(redis.get).toHaveBeenCalledWith("weather:São Paulo:metric");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should return mock data when no API key is set", async () => {
    // No API key set (default empty string in service)
    const result = await getWeather(redis, "Curitiba", "metric");

    expect(result.city).toBe("Curitiba");
    expect(result.temperature).toBe(22);
    expect(result.forecast).toHaveLength(3);
    expect(redis.setex).toHaveBeenCalled();
  });

  it("should cache the result with the given TTL", async () => {
    const result = await getWeather(redis, "Recife", "metric", 300);

    expect(redis.setex).toHaveBeenCalledWith(
      "weather:Recife:metric",
      expect.any(Number),
      expect.any(String)
    );
  });

  it("should use different cache keys for different units", async () => {
    await getWeather(redis, "São Paulo", "metric");
    await getWeather(redis, "São Paulo", "imperial");

    const calls = (redis.get as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]![0]).toBe("weather:São Paulo:metric");
    expect(calls[1]![0]).toBe("weather:São Paulo:imperial");
  });
});
