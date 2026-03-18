import { useState, useEffect } from "react";

interface ClockZoneProps {
  timezone?: string;
  showSeconds?: boolean;
  format?: "12h" | "24h";
  showDate?: boolean;
}

export function ClockZone({
  timezone,
  showSeconds = true,
  format = "24h",
  showDate = true,
}: ClockZoneProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12: format === "12h",
  });

  const dateStr = now.toLocaleDateString("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.8)",
        color: "white",
        fontFamily: "monospace",
      }}
    >
      <div style={{ fontSize: "clamp(2rem, 8vw, 6rem)", fontWeight: "bold" }}>
        {timeStr}
      </div>
      {showDate && (
        <div
          style={{
            fontSize: "clamp(0.75rem, 2vw, 1.5rem)",
            opacity: 0.8,
            marginTop: "0.5rem",
            textAlign: "center",
          }}
        >
          {dateStr}
        </div>
      )}
    </div>
  );
}
