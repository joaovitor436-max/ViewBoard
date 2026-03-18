import { useState } from "react";
import { motion } from "framer-motion";
import { usePlayerStore } from "@/store/playerStore";

const API_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001";

interface PairResponse {
  screenToken: string;
  screen: {
    id: string;
    name: string;
    tenantId: string;
    tenantSlug: string;
  };
}

export function PairingScreen() {
  const [pairingCode, setPairingCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const setScreenIdentity = usePlayerStore((s) => s.setScreenIdentity);

  const handlePair = async () => {
    if (!pairingCode.trim()) {
      setError("Please enter a pairing code");
      return;
    }

    setIsPairing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/screen/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingCode: pairingCode.toUpperCase().trim(),
          deviceInfo: {
            resolution: {
              width: window.screen.width,
              height: window.screen.height,
            },
            userAgent: navigator.userAgent,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Pairing failed");
      }

      const { screenToken, screen } = data.data as PairResponse;

      setScreenIdentity({
        screenId: screen.id,
        screenToken,
        tenantId: screen.tenantId,
        tenantSlug: screen.tenantSlug,
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "Pairing failed. Please try again.");
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(135deg, #0f0f1a, #1a1a2e)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
          maxWidth: "400px",
          width: "90%",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "0.5rem",
            }}
          >
            📺
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", margin: 0 }}>
            ViewBoard
          </h1>
          <p style={{ color: "#9ca3af", marginTop: "0.5rem" }}>
            Digital Signage Player
          </p>
        </div>

        {/* Pairing form */}
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "1rem",
            padding: "2rem",
            width: "100%",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "1.5rem",
              fontSize: "1.25rem",
            }}
          >
            Screen Pairing
          </h2>

          <p style={{ color: "#9ca3af", marginBottom: "1rem", fontSize: "0.875rem", textAlign: "center" }}>
            Enter the pairing code from your ViewBoard dashboard to connect this screen.
          </p>

          <input
            type="text"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handlePair()}
            placeholder="ALPHA-1234"
            maxLength={12}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              fontSize: "1.5rem",
              textAlign: "center",
              letterSpacing: "0.1em",
              fontWeight: "bold",
              background: "rgba(255,255,255,0.1)",
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: "0.5rem",
              color: "white",
              outline: "none",
              boxSizing: "border-box",
            }}
            autoFocus
          />

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                color: "#f87171",
                marginTop: "0.75rem",
                fontSize: "0.875rem",
                textAlign: "center",
              }}
            >
              {error}
            </motion.p>
          )}

          <button
            onClick={handlePair}
            disabled={isPairing}
            style={{
              width: "100%",
              marginTop: "1rem",
              padding: "0.875rem",
              background: isPairing ? "#374151" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: isPairing ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {isPairing ? "Pairing..." : "Pair Screen"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
