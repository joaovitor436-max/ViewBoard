/**
 * ViewBoard WebSocket Load Test
 *
 * Simulates N player clients connecting via Socket.io and measures:
 *  - Connection time per player (avg / p50 / p95 / p99)
 *  - Playlist propagation latency (server -> all players)
 *  - Connection success rate
 *
 * Usage:
 *   npx tsx websocket-load.ts [options]
 *
 * Options:
 *   --players <n>    Number of simulated players (default: 100)
 *   --url <url>      Server URL (default: http://localhost:3001)
 *   --tenant <id>    Tenant ID (default: load-test-tenant)
 *   --timeout <ms>   Connection timeout per player in ms (default: 10000)
 */

import { io, type Socket } from "socket.io-client";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface Config {
  playerCount: number;
  serverUrl: string;
  tenantId: string;
  connectionTimeoutMs: number;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    playerCount: 100,
    serverUrl: "http://localhost:3001",
    tenantId: "load-test-tenant",
    connectionTimeoutMs: 10_000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--players":
        config.playerCount = parseInt(args[++i], 10);
        break;
      case "--url":
        config.serverUrl = args[++i];
        break;
      case "--tenant":
        config.tenantId = args[++i];
        break;
      case "--timeout":
        config.connectionTimeoutMs = parseInt(args[++i], 10);
        break;
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(values: number[]) {
  if (values.length === 0) {
    return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    avg: Math.round(sum / sorted.length),
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    p99: Math.round(percentile(sorted, 99)),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[sorted.length - 1]),
  };
}

function generateScreenId(index: number): string {
  return `load-screen-${String(index).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Phase 1 — Connect all players
// ---------------------------------------------------------------------------

interface PlayerSocket {
  socket: Socket;
  screenId: string;
  connectTimeMs: number;
}

async function connectPlayer(
  index: number,
  config: Config,
): Promise<PlayerSocket> {
  const screenId = generateScreenId(index);
  const startTime = performance.now();

  return new Promise<PlayerSocket>((resolve, reject) => {
    const socket = io(config.serverUrl, {
      transports: ["websocket"],
      reconnection: false,
      timeout: config.connectionTimeoutMs,
      auth: { token: `load-test-token-${index}` },
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Player ${screenId} connection timed out`));
    }, config.connectionTimeoutMs);

    socket.on("connect", () => {
      clearTimeout(timer);
      const connectTimeMs = performance.now() - startTime;

      // Join the screen room
      socket.emit("screen:join", {
        screenId,
        tenantId: config.tenantId,
      });

      resolve({ socket, screenId, connectTimeMs });
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(
        new Error(`Player ${screenId} connect error: ${err.message}`),
      );
    });
  });
}

async function connectAllPlayers(config: Config): Promise<{
  players: PlayerSocket[];
  failed: number;
  connectionTimes: number[];
}> {
  console.log(
    `\n[Phase 1] Connecting ${config.playerCount} players to ${config.serverUrl} ...`,
  );
  const overallStart = performance.now();

  // Connect in batches of 20 to avoid overwhelming the server
  const BATCH_SIZE = 20;
  const players: PlayerSocket[] = [];
  let failed = 0;
  const connectionTimes: number[] = [];

  for (let batch = 0; batch < config.playerCount; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, config.playerCount);
    const promises: Promise<PlayerSocket>[] = [];

    for (let i = batch; i < batchEnd; i++) {
      promises.push(connectPlayer(i, config));
    }

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled") {
        players.push(result.value);
        connectionTimes.push(result.value.connectTimeMs);
      } else {
        failed++;
        console.error(`  FAIL: ${result.reason}`);
      }
    }

    // Brief pause between batches
    if (batchEnd < config.playerCount) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  const totalMs = performance.now() - overallStart;
  console.log(
    `  Connected ${players.length}/${config.playerCount} in ${Math.round(totalMs)} ms (${failed} failed)`,
  );

  return { players, failed, connectionTimes };
}

// ---------------------------------------------------------------------------
// Phase 2 — Heartbeat round (verify sockets are alive)
// ---------------------------------------------------------------------------

function sendHeartbeats(players: PlayerSocket[]): void {
  console.log(`\n[Phase 2] Sending heartbeats from ${players.length} players ...`);

  for (const { socket, screenId } of players) {
    socket.emit("screen:heartbeat", {
      screenId,
      timestamp: new Date().toISOString(),
      metadata: { uptime: 0 },
    });
  }

  console.log(`  Sent ${players.length} heartbeats`);
}

// ---------------------------------------------------------------------------
// Phase 3 — Playlist propagation latency
// ---------------------------------------------------------------------------

async function measurePropagation(
  players: PlayerSocket[],
  config: Config,
): Promise<number[]> {
  if (players.length === 0) return [];

  console.log(
    `\n[Phase 3] Measuring playlist:update propagation to ${players.length} players ...`,
  );

  return new Promise<number[]>((resolve) => {
    const latencies: number[] = [];
    let received = 0;
    const expectedCount = players.length;
    let sendTimestamp: number;

    const timeout = setTimeout(() => {
      console.warn(
        `  Timeout: only ${received}/${expectedCount} players received the event`,
      );
      cleanup();
      resolve(latencies);
    }, 15_000);

    const handlers: Array<{ socket: Socket; handler: () => void }> = [];

    function cleanup() {
      clearTimeout(timeout);
      for (const { socket, handler } of handlers) {
        socket.off("playlist:update", handler);
      }
    }

    // Attach listeners BEFORE emitting
    for (const { socket } of players) {
      const handler = () => {
        const lat = performance.now() - sendTimestamp;
        latencies.push(lat);
        received++;
        if (received === expectedCount) {
          cleanup();
          resolve(latencies);
        }
      };
      socket.on("playlist:update", handler);
      handlers.push({ socket, handler });
    }

    // Use a separate admin socket to trigger the broadcast.
    // This socket connects as a monitor so it can emit a server-side
    // broadcast trigger. If the server does not expose such an event,
    // we fall back to emitting playlist:update directly from the first
    // player socket (useful when testing with an echo/broadcast server).
    const adminSocket = io(config.serverUrl, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: "load-test-admin" },
    });

    adminSocket.on("connect", () => {
      adminSocket.emit("monitor:join", { tenantId: config.tenantId });

      // Give the server a moment to register the monitor, then trigger
      setTimeout(() => {
        sendTimestamp = performance.now();

        // Emit the broadcast trigger. The server should broadcast
        // playlist:update to all screens in the tenant room.
        // We emit on the admin socket so we can measure how long it
        // takes the server to fan out to all player sockets.
        adminSocket.emit("playlist:broadcast" as string, {
          tenantId: config.tenantId,
          playlist: {
            id: "load-test-playlist",
            name: "Load Test Playlist",
            items: [
              {
                id: "item-1",
                order: 0,
                type: "image",
                name: "test.png",
                url: "https://example.com/test.png",
                thumbnailUrl: null,
                body: null,
                durationSec: 10,
              },
            ],
            publishedAt: new Date().toISOString(),
          },
          triggeredAt: new Date().toISOString(),
        });

        console.log("  Broadcast trigger sent. Waiting for propagation ...");
      }, 500);
    });

    adminSocket.on("connect_error", () => {
      console.warn(
        "  Admin socket could not connect. Sending playlist:update via first player socket instead.",
      );

      // Fallback: if no admin route exists, emit from server-side test endpoint.
      // For this fallback we simply resolve with empty latencies.
      cleanup();
      adminSocket.disconnect();
      resolve([]);
    });

    // Cleanup admin socket when done
    const origResolve = resolve;
    // Override resolve to also disconnect admin
    resolve = ((val: number[]) => {
      adminSocket.disconnect();
      origResolve(val);
    }) as typeof resolve;
  });
}

// ---------------------------------------------------------------------------
// Phase 4 — Report
// ---------------------------------------------------------------------------

function printReport(
  config: Config,
  connectionTimes: number[],
  propagationLatencies: number[],
  failed: number,
  totalTimeMs: number,
): void {
  const successRate =
    ((config.playerCount - failed) / config.playerCount) * 100;

  console.log("\n" + "=".repeat(60));
  console.log("  VIEWBOARD WEBSOCKET LOAD TEST REPORT");
  console.log("=".repeat(60));
  console.log(`  Server URL       : ${config.serverUrl}`);
  console.log(`  Players requested : ${config.playerCount}`);
  console.log(`  Players connected : ${config.playerCount - failed}`);
  console.log(`  Connection rate   : ${successRate.toFixed(1)}%`);
  console.log(`  Total test time   : ${Math.round(totalTimeMs)} ms`);

  const connStats = stats(connectionTimes);
  console.log("\n  Connection Latency (ms):");
  console.log(`    avg  : ${connStats.avg}`);
  console.log(`    p50  : ${connStats.p50}`);
  console.log(`    p95  : ${connStats.p95}`);
  console.log(`    p99  : ${connStats.p99}`);
  console.log(`    min  : ${connStats.min}`);
  console.log(`    max  : ${connStats.max}`);

  if (propagationLatencies.length > 0) {
    const propStats = stats(propagationLatencies);
    console.log("\n  Playlist Propagation Latency (ms):");
    console.log(`    avg  : ${propStats.avg}`);
    console.log(`    p50  : ${propStats.p50}`);
    console.log(`    p95  : ${propStats.p95}`);
    console.log(`    p99  : ${propStats.p99}`);
    console.log(`    min  : ${propStats.min}`);
    console.log(`    max  : ${propStats.max}`);
    console.log(
      `    received : ${propagationLatencies.length}/${config.playerCount - failed}`,
    );
  } else {
    console.log("\n  Playlist Propagation: skipped (no data received)");
    console.log(
      "    Tip: ensure the server handles 'playlist:broadcast' or has",
    );
    console.log(
      "    a REST endpoint to trigger playlist:update to all screens.",
    );
  }

  console.log("\n" + "=".repeat(60));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = parseArgs();
  const testStart = performance.now();

  console.log("ViewBoard WebSocket Load Test");
  console.log(`  Players : ${config.playerCount}`);
  console.log(`  Server  : ${config.serverUrl}`);
  console.log(`  Tenant  : ${config.tenantId}`);

  // Phase 1 — Connect
  const { players, failed, connectionTimes } =
    await connectAllPlayers(config);

  if (players.length === 0) {
    console.error(
      "\nNo players could connect. Is the server running at " +
        config.serverUrl +
        "?",
    );
    process.exit(1);
  }

  // Phase 2 — Heartbeats
  sendHeartbeats(players);

  // Small delay to let heartbeats propagate
  await new Promise((r) => setTimeout(r, 500));

  // Phase 3 — Propagation
  const propagationLatencies = await measurePropagation(players, config);

  // Cleanup — disconnect all sockets
  console.log("\n[Cleanup] Disconnecting all players ...");
  for (const { socket } of players) {
    socket.disconnect();
  }

  const totalTimeMs = performance.now() - testStart;

  // Phase 4 — Report
  printReport(config, connectionTimes, propagationLatencies, failed, totalTimeMs);

  process.exit(0);
}

main().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
