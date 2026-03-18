import fp from "fastify-plugin";
import { Server } from "socket.io";
import type { FastifyPluginAsync } from "fastify";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
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

  io.on("connection", (socket) => {
    fastify.log.info({ socketId: socket.id }, "Socket connected");

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

    socket.on("disconnect", async () => {
      const { screenId, tenantId } = socket.data;
      fastify.log.info({ socketId: socket.id, screenId }, "Socket disconnected");

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
    });
  });

  fastify.decorate("io", io);

  fastify.addHook("onClose", async () => {
    io.close();
  });
});

export default socketPlugin;
