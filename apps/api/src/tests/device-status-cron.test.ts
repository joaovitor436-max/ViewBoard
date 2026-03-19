import { describe, it, expect, vi, beforeEach } from "vitest";
import { markStaleDevicesOffline } from "../modules/devices/devices.service.js";

// Mock PrismaClient
function createMockPrisma(updateManyResult: { count: number }) {
  return {
    device: {
      updateMany: vi.fn().mockResolvedValue(updateManyResult),
    },
  } as any;
}

describe("markStaleDevicesOffline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));
  });

  it("should call updateMany with correct threshold (3 minutes default)", async () => {
    const prisma = createMockPrisma({ count: 2 });

    const result = await markStaleDevicesOffline(prisma);

    expect(result).toBe(2);
    expect(prisma.device.updateMany).toHaveBeenCalledOnce();

    const call = prisma.device.updateMany.mock.calls[0]![0];
    expect(call.where.status).toBe("ONLINE");
    expect(call.data.status).toBe("OFFLINE");

    // Threshold should be 3 minutes before "now"
    const threshold = call.where.lastSeenAt.lt as Date;
    const expected = new Date("2026-03-18T11:57:00Z");
    expect(threshold.getTime()).toBe(expected.getTime());
  });

  it("should use custom threshold when provided", async () => {
    const prisma = createMockPrisma({ count: 0 });

    await markStaleDevicesOffline(prisma, 5);

    const call = prisma.device.updateMany.mock.calls[0]![0];
    const threshold = call.where.lastSeenAt.lt as Date;
    const expected = new Date("2026-03-18T11:55:00Z");
    expect(threshold.getTime()).toBe(expected.getTime());
  });

  it("should return 0 when no devices are stale", async () => {
    const prisma = createMockPrisma({ count: 0 });

    const result = await markStaleDevicesOffline(prisma);

    expect(result).toBe(0);
  });

  it("should only target ONLINE devices, not PENDING or already OFFLINE", async () => {
    const prisma = createMockPrisma({ count: 1 });

    await markStaleDevicesOffline(prisma);

    const call = prisma.device.updateMany.mock.calls[0]![0];
    expect(call.where.status).toBe("ONLINE");
  });
});
