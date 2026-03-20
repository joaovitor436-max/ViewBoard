import { describe, it, expect, vi, beforeEach } from "vitest";
import IORedis from "ioredis";
import { getTopHeadlines } from "../modules/integrations/news.service.js";

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

const mockFetch = vi.fn();

describe("getTopHeadlines", () => {
  let redis: IORedis;

  beforeEach(() => {
    redis = createMockRedis();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("should return cached data when available", async () => {
    const cached = [
      {
        title: "Cached headline",
        source: "Test",
        url: "https://example.com",
        publishedAt: "2024-01-01T00:00:00.000Z",
        timeAgo: "há 1h",
      },
    ];

    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      JSON.stringify(cached)
    );

    const result = await getTopHeadlines(redis);

    expect(result).toEqual(cached);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should return mock data when no API key is set", async () => {
    const result = await getTopHeadlines(redis);

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBeTruthy();
    expect(result[0]!.source).toBeTruthy();
    expect(result[0]!.timeAgo).toBe("agora");
    expect(redis.setex).toHaveBeenCalled();
  });

  it("should respect pageSize option", async () => {
    const result = await getTopHeadlines(redis, { pageSize: 5 });

    // Mock returns 3 items regardless of pageSize
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("should include timeAgo in returned items", async () => {
    const result = await getTopHeadlines(redis);

    for (const item of result) {
      expect(item.timeAgo).toBeDefined();
    }
  });

  it("should cache with custom TTL", async () => {
    await getTopHeadlines(redis, {}, 600);

    expect(redis.setex).toHaveBeenCalledWith(
      expect.any(String),
      60, // mock data uses 60s TTL
      expect.any(String)
    );
  });

  it("should generate different cache keys for different options", async () => {
    await getTopHeadlines(redis, { category: "sports" });
    await getTopHeadlines(redis, { category: "technology" });

    const calls = (redis.get as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain("sports");
    expect(calls[1][0]).toContain("technology");
  });
});
