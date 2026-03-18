"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@viewboard/shared";

type ViewBoardSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ViewBoardSocket | null = null;

export function getSocket(): ViewBoardSocket {
  if (!socket) {
    const WS_URL =
      process.env["NEXT_PUBLIC_WS_URL"] ?? "http://localhost:3001";

    socket = io(WS_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });
  }

  return socket;
}

export function connectAsMonitor(tenantId: string): ViewBoardSocket {
  const s = getSocket();

  if (!s.connected) {
    s.connect();
  }

  s.once("connect", () => {
    s.emit("monitor:join", { tenantId });
  });

  if (s.connected) {
    s.emit("monitor:join", { tenantId });
  }

  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}
