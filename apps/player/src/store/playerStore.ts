import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ContentItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  body?: Record<string, unknown>;
  durationSec: number;
}

export interface PlaylistItem {
  id: string;
  contentId: string;
  zoneId: string;
  order: number;
  durationSec?: number;
  content: ContentItem;
}

export interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  role?: "media" | "widget";
}

export interface LayoutWidget {
  type: "clock" | "weather" | "news";
  enabled: boolean;
}

export interface LayoutConfig {
  backgroundColor: string;
  logoUrl: string | null;
  widgets: LayoutWidget[];
  fontFamily: string;
  fontSize: number;
}

export type LayoutTemplate = "FULLSCREEN" | "SPLIT_BOTTOM" | "SPLIT_SIDE" | "GRID";

export interface Layout {
  id: string;
  name: string;
  zones: Zone[];
}

export interface Playlist {
  id: string;
  name: string;
  layoutId: string;
  layout: Layout;
  items: PlaylistItem[];
}

export interface DeviceLayout {
  template: LayoutTemplate;
  zones: Zone[];
  config: LayoutConfig;
}

export interface PlayerState {
  // Identidade
  screenId: string | null;
  screenToken: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  isPaired: boolean;

  // Layout do dispositivo (recebido via device:config)
  deviceLayout: DeviceLayout | null;

  // Playlist atual
  currentPlaylist: Playlist | null;
  isPlaying: boolean;

  // Conexão
  isConnected: boolean;
  lastHeartbeatAt: string | null;

  // Ações
  setScreenIdentity: (data: {
    screenId: string;
    screenToken: string;
    tenantId: string;
    tenantSlug: string;
  }) => void;
  setPlaylist: (playlist: Playlist) => void;
  setDeviceLayout: (layout: DeviceLayout) => void;
  setConnected: (connected: boolean) => void;
  setHeartbeat: (at: string) => void;
  reset: () => void;
}

const DEFAULT_LAYOUT: DeviceLayout = {
  template: "FULLSCREEN",
  zones: [
    { id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 100, zIndex: 0, role: "media" },
  ],
  config: {
    backgroundColor: "#000000",
    logoUrl: null,
    widgets: [
      { type: "clock", enabled: false },
      { type: "weather", enabled: false },
      { type: "news", enabled: false },
    ],
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 16,
  },
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      screenId: null,
      screenToken: null,
      tenantId: null,
      tenantSlug: null,
      isPaired: false,
      deviceLayout: null,
      currentPlaylist: null,
      isPlaying: false,
      isConnected: false,
      lastHeartbeatAt: null,

      setScreenIdentity: (data) =>
        set({
          screenId: data.screenId,
          screenToken: data.screenToken,
          tenantId: data.tenantId,
          tenantSlug: data.tenantSlug,
          isPaired: true,
        }),

      setPlaylist: (playlist) =>
        set({ currentPlaylist: playlist, isPlaying: true }),

      setDeviceLayout: (layout) =>
        set({ deviceLayout: layout }),

      setConnected: (connected) => set({ isConnected: connected }),

      setHeartbeat: (at) => set({ lastHeartbeatAt: at }),

      reset: () =>
        set({
          screenId: null,
          screenToken: null,
          tenantId: null,
          tenantSlug: null,
          isPaired: false,
          deviceLayout: null,
          currentPlaylist: null,
          isPlaying: false,
          isConnected: false,
          lastHeartbeatAt: null,
        }),
    }),
    {
      name: "viewboard-player",
      partialize: (state) => ({
        screenId: state.screenId,
        screenToken: state.screenToken,
        tenantId: state.tenantId,
        tenantSlug: state.tenantSlug,
        isPaired: state.isPaired,
        deviceLayout: state.deviceLayout,
      }),
    }
  )
);

export { DEFAULT_LAYOUT };
