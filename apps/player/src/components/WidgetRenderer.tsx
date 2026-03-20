import { useState, useEffect } from "react";
import type { LayoutConfig } from "@/store/playerStore";
import { useWidgets } from "@/hooks/useWidgets";
import { ClockZone } from "./zones/ClockZone";
import { WeatherZone } from "./zones/WeatherZone";
import { TickerZone } from "./zones/TickerZone";

interface WidgetRendererProps {
  zoneId: string;
  config: LayoutConfig;
  style?: React.CSSProperties;
}

export function WidgetRenderer({ zoneId, config, style }: WidgetRendererProps) {
  const { weather, news, weatherConfig } = useWidgets();
  const enabledWidgets = config.widgets.filter((w) => w.enabled);

  if (enabledWidgets.length === 0) {
    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.2)",
          fontSize: "0.75rem",
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...style,
        display: "flex",
        flexDirection: style?.width && style?.height
          ? "row"
          : "column",
        gap: 0,
      }}
    >
      {enabledWidgets.map((widget) => (
        <div
          key={widget.type}
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {widget.type === "clock" && (
            <ClockWidget fontFamily={config.fontFamily} />
          )}
          {widget.type === "weather" && (
            <WeatherZone
              data={weather}
              unit={weatherConfig?.unit}
            />
          )}
          {widget.type === "news" && (
            <TickerZone
              newsItems={news}
              speed={60}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Widget de relógio compacto para barras laterais/inferiores
function ClockWidget({ fontFamily }: { fontFamily: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const date = now.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
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
        background: "rgba(0,0,0,0.6)",
        color: "white",
        fontFamily,
      }}
    >
      <div
        style={{
          fontSize: "clamp(1.25rem, 4vw, 3rem)",
          fontWeight: "bold",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {time}
      </div>
      <div
        style={{
          fontSize: "clamp(0.5rem, 1.5vw, 0.875rem)",
          opacity: 0.7,
          marginTop: "0.25rem",
          textTransform: "capitalize",
        }}
      >
        {date}
      </div>
    </div>
  );
}
