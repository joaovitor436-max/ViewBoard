import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "@/store/playerStore";
import { PairingScreen } from "@/components/PairingScreen";
import { Layout } from "@/components/Layout";
import { useSocket } from "@/hooks/useSocket";

// Check for pre-configured screen ID in headless/kiosk mode
const PRESET_SCREEN_ID = import.meta.env["VITE_SCREEN_ID"] as string | undefined;

function ConnectionIndicator() {
  const isConnected = usePlayerStore((s) => s.isConnected);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setWasDisconnected(true);
      setShowReconnected(false);
      return undefined;
    }
    if (wasDisconnected) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasDisconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isConnected, wasDisconnected]);

  // Online: só mostrar bolinha verde discreta
  if (isConnected && !showReconnected) {
    return (
      <div
        style={{
          position: "fixed",
          top: "0.5rem",
          right: "0.5rem",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#22c55e",
          zIndex: 9999,
          opacity: 0.7,
        }}
      />
    );
  }

  // Reconectado: indicador temporário
  if (isConnected && showReconnected) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 3 }}
        style={{
          position: "fixed",
          bottom: "1rem",
          left: "1rem",
          background: "rgba(34, 197, 94, 0.9)",
          color: "#fff",
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          fontSize: "0.8rem",
          fontFamily: "system-ui, sans-serif",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          backdropFilter: "blur(8px)",
        }}
      >
        <span style={{ fontSize: "0.6rem" }}>&#9679;</span>
        Online — conteúdo sincronizado
      </motion.div>
    );
  }

  // Offline: indicador persistente discreto
  return (
    <div
      style={{
        position: "fixed",
        bottom: "1rem",
        left: "1rem",
        background: "rgba(0, 0, 0, 0.75)",
        color: "#9ca3af",
        padding: "0.5rem 1rem",
        borderRadius: "0.5rem",
        fontSize: "0.8rem",
        fontFamily: "system-ui, sans-serif",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        backdropFilter: "blur(8px)",
      }}
    >
      <span style={{ color: "#f59e0b", fontSize: "0.6rem" }}>&#9679;</span>
      Offline — exibindo conteúdo salvo
    </div>
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
        <div style={{ fontSize: "3rem" }}>&#128250;</div>
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
