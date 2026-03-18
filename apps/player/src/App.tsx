import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "@/store/playerStore";
import { PairingScreen } from "@/components/PairingScreen";
import { Layout } from "@/components/Layout";
import { useSocket } from "@/hooks/useSocket";

// Check for pre-configured screen ID in headless/kiosk mode
const PRESET_SCREEN_ID = import.meta.env["VITE_SCREEN_ID"] as string | undefined;

function ConnectionIndicator() {
  const isConnected = usePlayerStore((s) => s.isConnected);
  return (
    <div
      style={{
        position: "fixed",
        top: "0.5rem",
        right: "0.5rem",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: isConnected ? "#22c55e" : "#ef4444",
        zIndex: 9999,
        opacity: 0.7,
      }}
    />
  );
}

function PlayerContent() {
  const { currentPlaylist, isPaired } = usePlayerStore();
  useSocket();

  if (!isPaired) {
    return <PairingScreen />;
  }

  if (!currentPlaylist) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#4b5563",
          fontFamily: "system-ui, sans-serif",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "3rem" }}>📺</div>
        <div style={{ fontSize: "1.25rem" }}>Aguardando conteúdo...</div>
        <div style={{ fontSize: "0.875rem", opacity: 0.6 }}>
          A tela está online e conectada
        </div>
      </div>
    );
  }

  return <Layout playlist={currentPlaylist} />;
}

export default function App() {
  return (
    <>
      <ConnectionIndicator />
      <AnimatePresence mode="wait">
        <PlayerContent />
      </AnimatePresence>
    </>
  );
}
