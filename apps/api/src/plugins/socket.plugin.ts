import fp from "fastify-plugin";
import { Server } from "socket.io";
import { jwtVerify } from "jose";
import type { FastifyPluginAsync } from "fastify";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  PlayerJwtPayload,
} from "@viewboard/shared";

declare module "fastify" {
  interface FastifyInstance {
    io: Server<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >;
  }
}

const socketPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(fastify.server, {
    cors: {
      origin: process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  const JWT_SECRET = process.env["JWT_SECRET"] ?? "fallback-secret-change-me";
  const jwtSecret = new TextEncoder().encode(JWT_SECRET);

  io.on("connection", (socket) => {
    fastify.log.info({ socketId: socket.id }, "Socket connected");

    // ── Screen events (existing) ──────────────────────────────────────

    socket.on("screen:join", async ({ screenId, tenantId }) => {
      socket.data.screenId = screenId;
      socket.data.tenantId = tenantId;

      // Join screen-specific room and tenant room
      await socket.join(`screen:${screenId}`);
      await socket.join(`tenant:${tenantId}`);

      fastify.log.info({ screenId, tenantId }, "Screen joined rooms");

      // Notify monitors
      io.to(`tenant:${tenantId}:monitors`).emit("screen:status", {
        screenId,
        status: "ONLINE",
        lastSeenAt: new Date().toISOString(),
      });

      // Send current playlist to the screen if one is assigned
      try {
        const screen = await fastify.prisma.screen.findUnique({
          where: { id: screenId },
          select: { currentPlaylistId: true },
        });
        if (screen?.currentPlaylistId) {
          const playlist = await fastify.prisma.playlist.findUnique({
            where: { id: screen.currentPlaylistId },
            include: {
              items: {
                include: { media: true },
                orderBy: { order: "asc" },
              },
            },
          });
          if (playlist) {
            socket.emit("playlist:update", playlist);
            fastify.log.info(
              { screenId, playlistId: playlist.id },
              "Sent current playlist to screen on join"
            );
          }
        }
      } catch (err) {
        fastify.log.error({ err, screenId }, "Failed to send playlist on screen join");
      }
    });

    socket.on("monitor:join", async ({ tenantId }) => {
      socket.data.tenantId = tenantId;
      await socket.join(`tenant:${tenantId}:monitors`);
      fastify.log.info({ tenantId }, "Monitor joined tenant room");
    });

    socket.on("screen:heartbeat", async (payload) => {
      const { screenId, tenantId } = socket.data;
      if (!screenId || !tenantId) return;

      // Persist heartbeat via prisma
      try {
        await fastify.prisma.screen.update({
          where: { id: screenId },
          data: {
            status: "ONLINE",
            lastSeenAt: new Date(payload.timestamp),
            heartbeats: {
              create: {
                timestamp: new Date(payload.timestamp),
                metadata: payload.metadata as object | undefined,
              },
            },
          },
        });
      } catch (err) {
        fastify.log.error({ err, screenId }, "Failed to persist heartbeat");
      }

      // Broadcast status to monitors
      io.to(`tenant:${tenantId}:monitors`).emit("screen:status", {
        screenId,
        status: "ONLINE",
        lastSeenAt: payload.timestamp,
        metadata: payload.metadata,
      });
    });

    socket.on("screen:error", async (payload) => {
      const { screenId, tenantId } = socket.data;
      if (!screenId || !tenantId) return;

      fastify.log.error(
        { screenId, error: payload.error },
        "Screen reported error"
      );

      try {
        await fastify.prisma.screen.update({
          where: { id: screenId },
          data: { status: "ERROR", lastSeenAt: new Date() },
        });
      } catch (err) {
        fastify.log.error({ err }, "Failed to update screen error status");
      }

      io.to(`tenant:${tenantId}:monitors`).emit("screen:status", {
        screenId,
        status: "ERROR",
        lastSeenAt: new Date().toISOString(),
      });
    });

    // ── Device player events (Phase 4) ────────────────────────────────

    socket.on("device:join", async ({ deviceId, tenantId, token }) => {
      // Authenticate the player token
      try {
        const { payload } = await jwtVerify(token, jwtSecret);
        const decoded = payload as unknown as PlayerJwtPayload;
        if (decoded.type !== "player" || decoded.deviceId !== deviceId) {
          fastify.log.warn({ deviceId }, "Device join rejected: invalid token");
          socket.disconnect(true);
          return;
        }
      } catch {
        fastify.log.warn({ deviceId }, "Device join rejected: token verification failed");
        socket.disconnect(true);
        return;
      }

      socket.data.deviceId = deviceId;
      socket.data.tenantId = tenantId;

      await socket.join(`device:${deviceId}`);
      await socket.join(`tenant:${tenantId}`);

      fastify.log.info({ deviceId, tenantId }, "Device player joined rooms");

      // Update device status to ONLINE
      try {
        await fastify.prisma.device.update({
          where: { id: deviceId },
          data: { status: "ONLINE", lastSeenAt: new Date() },
        });
      } catch (err) {
        fastify.log.error({ err, deviceId }, "Failed to update device status on join");
      }
    });

    socket.on("device:heartbeat", async ({ deviceId, timestamp }) => {
      if (!socket.data.deviceId || socket.data.deviceId !== deviceId) return;

      try {
        await fastify.prisma.device.update({
          where: { id: deviceId },
          data: { status: "ONLINE", lastSeenAt: new Date(timestamp) },
        });
      } catch (err) {
        fastify.log.error({ err, deviceId }, "Failed to persist device heartbeat");
      }
    });

    socket.on("pong", () => {
      // Client responded to ping — connection is alive
    });

    // ── Disconnect (handles both screen and device) ───────────────────

    socket.on("disconnect", async () => {
      const { screenId, deviceId, tenantId } = socket.data;
      fastify.log.info(
        { socketId: socket.id, screenId, deviceId },
        "Socket disconnected"
      );

      if (screenId && tenantId) {
        try {
          await fastify.prisma.screen.update({
            where: { id: screenId },
            data: { status: "OFFLINE" },
          });
        } catch (err) {
          fastify.log.error({ err }, "Failed to update screen offline status");
        }

        io.to(`tenant:${tenantId}:monitors`).emit("screen:status", {
          screenId,
          status: "OFFLINE",
          lastSeenAt: new Date().toISOString(),
        });
      }

      if (deviceId) {
        try {
          await fastify.prisma.device.update({
            where: { id: deviceId },
            data: { status: "OFFLINE" },
          });
        } catch (err) {
          fastify.log.error({ err, deviceId }, "Failed to update device offline status");
        }
      }
    });
  });

  // ── Periodic ping to all device players ─────────────────────────────
  const pingInterval = setInterval(() => {
    io.emit("ping");
  }, 25000);

  fastify.decorate("io", io);

  fastify.addHook("onClose", async () => {
    clearInterval(pingInterval);
    io.close();
  });
});

export default socketPlugin;
