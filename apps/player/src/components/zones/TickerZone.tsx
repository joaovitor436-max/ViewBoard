import { useEffect, useRef } from "react";
import type { NewsItem } from "@/hooks/useWidgets";

interface TickerZoneProps {
  items?: string[];
  newsItems?: NewsItem[];
  speed?: number; // pixels per second
  backgroundColor?: string;
  textColor?: string;
  // Legacy props
  apiUrl?: string;
  screenToken?: string;
}

export function TickerZone({
  items,
  newsItems,
  speed = 80,
  backgroundColor = "#1a1a2e",
  textColor = "#e2e8f0",
}: TickerZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  // Build headlines from newsItems or fallback to items
  const headlines: string[] = newsItems
    ? newsItems.map(
        (n) => `${n.title}${n.source ? ` — ${n.source}` : ""}${n.timeAgo ? ` (${n.timeAgo})` : ""}`
      )
    : items ?? [];

  useEffect(() => {
    if (!containerRef.current || !contentRef.current || headlines.length === 0)
      return;

    const container = containerRef.current;
    const content = contentRef.current;
    const contentWidth = content.scrollWidth;
    const duration = (contentWidth / speed) * 1000;

    animRef.current = content.animate(
      [
        { transform: `translateX(${container.offsetWidth}px)` },
        { transform: `translateX(-${contentWidth}px)` },
      ],
      {
        duration,
        iterations: Infinity,
        easing: "linear",
      }
    );

    return () => {
      animRef.current?.cancel();
    };
  }, [headlines, speed]);

  const text = headlines.join("  ·  ");

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        background: backgroundColor,
        color: textColor,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        position: "relative",
      }}
    >
      <div
        ref={contentRef}
        style={{
          whiteSpace: "nowrap",
          fontSize: "clamp(0.75rem, 2vw, 1.25rem)",
          fontWeight: 500,
          paddingLeft: "1rem",
          position: "absolute",
        }}
      >
        {text || "Nenhuma manchete disponível"}
      </div>
    </div>
  );
}
