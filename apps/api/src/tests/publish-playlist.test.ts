import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolvePlaylistForDevice,
  cachePlaylistForDevice,
  getCachedPlaylist,
  publishPlaylistToDevices,
} from "../modules/player/player.service.js";
import type { DevicePlaylistPayload } from "@viewboard/shared";

// ── Mock factories ──────────────────────────────────────────────────────

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    _store: store,
  };
}

function createMockIO() {
  const emitFn = vi.fn();
  return {
    to: vi.fn(() => ({ emit: emitFn })),
    _emit: emitFn,
  };
}

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  const defaultPlaylist = {
    id: "playlist-1",
    name: "Test Playlist",
    tenantId: "tenant-1",
    layout: { id: "layout-1", name: "Default", zones: [{ id: "main", x: 0, y: 0, width: 100, height: 100 }] },
    items: [
      {
        id: "item-1",
        order: 0,
        durationSec: 15,
        media: {
          id: "media-1",
          name: "Logo.png",
          type: "IMAGE",
          url: "https://storage.example.com/tenant-1/media/logo.png",
          thumbnailUrl: "https://storage.example.com/tenant-1/thumbs/logo.jpg",
          duration: null,
        },
        content: null,
      },
      {
        id: "item-2",
        order: 1,
        durationSec: 30,
        media: null,
        content: {
          id: "content-1",
          name: "Weather Widget",
          type: "WEATHER_WIDGET",
          url: null,
          body: { temperature: 25, description: "Sunny", city: "São Paulo" },
          durationSec: 30,
        },
      },
      {
        id: "item-3",
        order: 2,
        durationSec: null,
        media: {
          id: "media-2",
          name: "Promo.mp4",
          type: "VIDEO",
          url: "https://storage.example.com/tenant-1/media/promo.mp4",
          thumbnailUrl: "https://storage.example.com/tenant-1/thumbs/promo.jpg",
          duration: 60,
        },
        content: null,
      },
    ],
    ...overrides,
  };

  return {
    playlist: {
      findFirst: vi.fn(async () => defaultPlaylist),
    },
    device: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; tenantId: string } }) => {
        return where.id.in.map((id: string) => ({ id }));
      }),
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Player Service", () => {
  describe("resolvePlaylistForDevice", () => {
    it("should resolve a playlist into the device payload format", async () => {
      const prisma = createMockPrisma();
      const result = await resolvePlaylistForDevice(
        prisma as unknown as Parameters<typeof resolvePlaylistForDevice>[0],
        "playlist-1",
        "tenant-1"
      );

      expect(result.id).toBe("playlist-1");
      expect(result.name).toBe("Test Playlist");
      expect(result.items).toHaveLength(3);
      expect(result.publishedAt).toBeDefined();

      // Image item
      expect(result.items[0]!.type).toBe("IMAGE");
      expect(result.items[0]!.url).toBe("https://storage.example.com/tenant-1/media/logo.png");
      expect(result.items[0]!.durationSec).toBe(15);

      // Weather widget
      expect(result.items[1]!.type).toBe("WEATHER_WIDGET");
      expect(result.items[1]!.body).toEqual({ temperature: 25, description: "Sunny", city: "São Paulo" });
      expect(result.items[1]!.durationSec).toBe(30);

      // Video item — uses media duration as fallback when item durationSec is null
      expect(result.items[2]!.type).toBe("VIDEO");
      expect(result.items[2]!.durationSec).toBe(60);
    });

    it("should throw if playlist not found", async () => {
      const prisma = createMockPrisma();
      (prisma.playlist.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(
        resolvePlaylistForDevice(
          prisma as unknown as Parameters<typeof resolvePlaylistForDevice>[0],
          "nonexistent",
          "tenant-1"
        )
      ).rejects.toThrow("Playlist not found");
    });

    it("should include layout info when present", async () => {
      const prisma = createMockPrisma();
      const result = await resolvePlaylistForDevice(
        prisma as unknown as Parameters<typeof resolvePlaylistForDevice>[0],
        "playlist-1",
        "tenant-1"
      );

      expect(result.layout).toEqual({
        id: "layout-1",
        name: "Default",
        zones: [{ id: "main", x: 0, y: 0, width: 100, height: 100 }],
      });
    });
  });

  describe("cachePlaylistForDevice / getCachedPlaylist", () => {
    let redis: ReturnType<typeof createMockRedis>;

    beforeEach(() => {
      redis = createMockRedis();
    });

    it("should cache and retrieve a playlist", async () => {
      const payload: DevicePlaylistPayload = {
        id: "p1",
        name: "Test",
        layout: null,
        items: [
          { id: "i1", order: 0, type: "IMAGE", name: "Img", url: "http://x.com/img.png", durationSec: 10 },
        ],
        publishedAt: new Date().toISOString(),
      };

      await cachePlaylistForDevice(
        redis as unknown as Parameters<typeof cachePlaylistForDevice>[0],
        "device-1",
        payload
      );

      expect(redis.setex).toHaveBeenCalledWith(
        "device:device-1:playlist",
        86400,
        JSON.stringify(payload)
      );

      const cached = await getCachedPlaylist(
        redis as unknown as Parameters<typeof getCachedPlaylist>[0],
        "device-1"
      );

      expect(cached).toEqual(payload);
    });

    it("should return null when no cache exists", async () => {
      const cached = await getCachedPlaylist(
        redis as unknown as Parameters<typeof getCachedPlaylist>[0],
        "unknown-device"
      );

      expect(cached).toBeNull();
    });
  });

  describe("publishPlaylistToDevices", () => {
    it("should resolve, cache, and emit to each device", async () => {
      const prisma = createMockPrisma();
      const redis = createMockRedis();
      const io = createMockIO();

      const result = await publishPlaylistToDevices(
        prisma as unknown as Parameters<typeof publishPlaylistToDevices>[0],
        redis as unknown as Parameters<typeof publishPlaylistToDevices>[1],
        io as unknown as Parameters<typeof publishPlaylistToDevices>[2],
        "tenant-1",
        "playlist-1",
        ["device-A", "device-B"]
      );

      // Should publish to both devices
      expect(result.published).toBe(2);
      expect(result.deviceIds).toEqual(["device-A", "device-B"]);

      // Should cache for each device
      expect(redis.setex).toHaveBeenCalledTimes(2);
      expect(redis._store.has("device:device-A:playlist")).toBe(true);
      expect(redis._store.has("device:device-B:playlist")).toBe(true);

      // Should emit playlist:update to each device room
      expect(io.to).toHaveBeenCalledWith("device:device-A");
      expect(io.to).toHaveBeenCalledWith("device:device-B");
      expect(io._emit).toHaveBeenCalledTimes(2);

      // Verify emitted payload structure
      const emittedPayload = io._emit.mock.calls[0]![1] as DevicePlaylistPayload;
      expect(emittedPayload.id).toBe("playlist-1");
      expect(emittedPayload.items).toHaveLength(3);
    });

    it("should throw when no valid devices found", async () => {
      const prisma = createMockPrisma();
      (prisma.device.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      const redis = createMockRedis();
      const io = createMockIO();

      await expect(
        publishPlaylistToDevices(
          prisma as unknown as Parameters<typeof publishPlaylistToDevices>[0],
          redis as unknown as Parameters<typeof publishPlaylistToDevices>[1],
          io as unknown as Parameters<typeof publishPlaylistToDevices>[2],
          "tenant-1",
          "playlist-1",
          ["invalid-device"]
        )
      ).rejects.toThrow("No valid devices found");
    });

    it("should only publish to valid tenant devices", async () => {
      const prisma = createMockPrisma();
      // Simulate only 1 of 3 devices belonging to tenant
      (prisma.device.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: "device-A" },
      ]);
      const redis = createMockRedis();
      const io = createMockIO();

      const result = await publishPlaylistToDevices(
        prisma as unknown as Parameters<typeof publishPlaylistToDevices>[0],
        redis as unknown as Parameters<typeof publishPlaylistToDevices>[1],
        io as unknown as Parameters<typeof publishPlaylistToDevices>[2],
        "tenant-1",
        "playlist-1",
        ["device-A", "device-B", "device-C"]
      );

      expect(result.published).toBe(1);
      expect(result.deviceIds).toEqual(["device-A"]);
      expect(redis.setex).toHaveBeenCalledTimes(1);
      expect(io.to).toHaveBeenCalledTimes(1);
    });

    it("cached playlist should match emitted payload", async () => {
      const prisma = createMockPrisma();
      const redis = createMockRedis();
      const io = createMockIO();

      await publishPlaylistToDevices(
        prisma as unknown as Parameters<typeof publishPlaylistToDevices>[0],
        redis as unknown as Parameters<typeof publishPlaylistToDevices>[1],
        io as unknown as Parameters<typeof publishPlaylistToDevices>[2],
        "tenant-1",
        "playlist-1",
        ["device-A"]
      );

      // Get what was cached
      const cachedRaw = redis._store.get("device:device-A:playlist");
      expect(cachedRaw).toBeDefined();
      const cached = JSON.parse(cachedRaw!) as DevicePlaylistPayload;

      // Get what was emitted
      const emitted = io._emit.mock.calls[0]![1] as DevicePlaylistPayload;

      // They should be identical
      expect(cached.id).toBe(emitted.id);
      expect(cached.name).toBe(emitted.name);
      expect(cached.items.length).toBe(emitted.items.length);
      expect(cached.publishedAt).toBe(emitted.publishedAt);
    });
  });
});
