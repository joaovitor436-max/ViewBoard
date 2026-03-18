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
}

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

export interface PlayerState {
  // Screen identity
  screenId: string | null;
  screenToken: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  isPaired: boolean;

  // Playback state
  currentPlaylist: Playlist | null;
  isPlaying: boolean;

  // Connection state
  isConnected: boolean;
  lastHeartbeatAt: string | null;

  // Actions
  setScreenIdentity: (data: {
    screenId: string;
    screenToken: string;
    tenantId: string;
    tenantSlug: string;
  }) => void;
  setPlaylist: (playlist: Playlist) => void;
  setConnected: (connected: boolean) => void;
  setHeartbeat: (at: string) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      screenId: null,
      screenToken: null,
      tenantId: null,
      tenantSlug: null,
      isPaired: false,
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

      setConnected: (connected) => set({ isConnected: connected }),

      setHeartbeat: (at) => set({ lastHeartbeatAt: at }),

      reset: () =>
        set({
          screenId: null,
          screenToken: null,
          tenantId: null,
          tenantSlug: null,
          isPaired: false,
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
      }),
    }
  )
);
