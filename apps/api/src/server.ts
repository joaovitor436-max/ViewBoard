import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";

import prismaPlugin from "./plugins/prisma.plugin.js";
import redisPlugin from "./plugins/redis.plugin.js";
import socketPlugin from "./plugins/socket.plugin.js";
import authPlugin from "./plugins/auth.plugin.js";

import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import screensRoutes from "./modules/screens/screens.routes.js";
import contentRoutes from "./modules/content/content.routes.js";
import layoutsRoutes from "./modules/layouts/layouts.routes.js";
import playlistsRoutes from "./modules/playlists/playlists.routes.js";
import schedulesRoutes from "./modules/schedules/schedules.routes.js";
import monitoringRoutes from "./modules/monitoring/monitoring.routes.js";
import integrationsRoutes from "./modules/integrations/integrations.routes.js";
import mediaRoutes from "./modules/media/media.routes.js";
import devicesRoutes from "./modules/devices/devices.routes.js";
import deviceGroupsRoutes from "./modules/device-groups/device-groups.routes.js";

import { startScheduleWorker } from "./jobs/schedule.processor.js";
import { startWeatherWorker, scheduleWeatherRefresh } from "./jobs/weather.processor.js";
import { startNewsWorker, scheduleNewsRefresh } from "./jobs/news.processor.js";
import { startDeviceStatusWorker, scheduleDeviceStatusCheck } from "./jobs/device-status.processor.js";
import { ensureBucketExists, MINIO_BUCKET } from "./lib/minio.js";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";
const IS_DEV = process.env["NODE_ENV"] === "development";

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: LOG_LEVEL,
      transport: IS_DEV
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
  });

  // Security
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  const corsOrigins = (process.env["CORS_ORIGIN"] ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "Too many requests",
      code: "RATE_LIMIT_EXCEEDED",
    }),
  });

  await app.register(multipart, {
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB (videos)
  });

  // Core plugins
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(socketPlugin);
  await app.register(authPlugin);

  // API routes (versioned under /api/v1)
  await app.register(
    async (v1) => {
      await v1.register(authRoutes);
      await v1.register(usersRoutes);
      await v1.register(screensRoutes);
      await v1.register(contentRoutes);
      await v1.register(mediaRoutes);
      await v1.register(layoutsRoutes);
      await v1.register(playlistsRoutes);
      await v1.register(schedulesRoutes);
      await v1.register(devicesRoutes);
      await v1.register(deviceGroupsRoutes);
      await v1.register(monitoringRoutes);
      await v1.register(integrationsRoutes);
    },
    { prefix: "/api/v1" }
  );

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Ensure MinIO bucket exists
  try {
    await ensureBucketExists(MINIO_BUCKET);
    app.log.info(`MinIO bucket "${MINIO_BUCKET}" ready`);
  } catch (err) {
    app.log.warn({ err }, "MinIO not available - file uploads will fail");
  }

  // Start BullMQ workers
  const scheduleWorker = startScheduleWorker(app.io);
  const weatherWorker = startWeatherWorker();
  const newsWorker = startNewsWorker();
  const deviceStatusWorker = startDeviceStatusWorker();

  scheduleWorker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, err }, "Schedule worker job failed");
  });

  weatherWorker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, err }, "Weather worker job failed");
  });

  newsWorker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, err }, "News worker job failed");
  });

  deviceStatusWorker.on("failed", (job, err) => {
    app.log.error({ jobId: job?.id, err }, "Device status worker job failed");
  });

  deviceStatusWorker.on("completed", (job) => {
    const result = job.returnvalue as { markedOffline?: number } | undefined;
    if (result?.markedOffline && result.markedOffline > 0) {
      app.log.info(`Marked ${result.markedOffline} device(s) as OFFLINE`);
    }
  });

  // Schedule recurring background jobs
  await scheduleWeatherRefresh("São Paulo");
  await scheduleNewsRefresh({ country: "br" });
  await scheduleDeviceStatusCheck();

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error({ err: error, url: request.url }, "Unhandled error");
    reply.status(error.statusCode ?? 500).send({
      error: error.message ?? "Internal server error",
      code: "INTERNAL_ERROR",
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await scheduleWorker.close();
    await weatherWorker.close();
    await newsWorker.close();
    await deviceStatusWorker.close();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`ViewBoard API listening on http://${HOST}:${PORT}`);
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
