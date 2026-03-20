import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@viewboard/shared";
import { usePlayerStore } from "@/store/playerStore";
import type { DeviceLayout } from "@/store/playerStore";

type ViewBoardSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const WS_URL = import.meta.env["VITE_WS_URL"] ?? "http://localhost:3001";
const HEARTBEAT_INTERVAL_MS = 10_000;

export function useSocket() {
  const socketRef = useRef<ViewBoardSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    screenId,
    tenantId,
    screenToken,
    setConnected,
    setHeartbeat,
    setPlaylist,
    setDeviceLayout,
  } = usePlayerStore();

  useEffect(() => {
    if (!screenId || !tenantId) return;

    const socket: ViewBoardSocket = io(WS_URL, {
      auth: { token: screenToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("screen:join", { screenId, tenantId });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("playlist:update", (payload) => {
      setPlaylist(payload.playlist as never);
    });

    // Receber configuração de layout via device:config
    socket.on("device:config", (payload) => {
      const config = payload.config as Record<string, unknown>;
      if (config.layout) {
        setDeviceLayout(config.layout as DeviceLayout);
      }
    });

    socket.on("screen:reboot", () => {
      window.location.reload();
    });

    socket.on("screen:refresh-content", () => {
      const { currentPlaylist } = usePlayerStore.getState();
      if (currentPlaylist) {
        setPlaylist(currentPlaylist);
      }
    });

    // Heartbeat
    heartbeatRef.current = setInterval(() => {
      const now = new Date().toISOString();
      socket.emit("screen:heartbeat", {
        screenId,
        timestamp: now,
        metadata: {
          uptime: Math.floor(performance.now() / 1000),
        },
      });
      setHeartbeat(now);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      socket.disconnect();
    };
  }, [screenId, tenantId, screenToken, setConnected, setHeartbeat, setPlaylist, setDeviceLayout]);

  return socketRef.current;
}
