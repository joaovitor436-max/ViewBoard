import { useEffect, useRef, useState } from "react";
import type { NewsItem } from "@viewboard/shared";

interface TickerZoneProps {
  items?: string[];
  apiUrl?: string;
  screenToken?: string;
  speed?: number; // pixels per second
  backgroundColor?: string;
  textColor?: string;
}

export function TickerZone({
  items,
  apiUrl = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001",
  screenToken,
  speed = 80,
  backgroundColor = "#1a1a2e",
  textColor = "#e2e8f0",
}: TickerZoneProps) {
  const [headlines, setHeadlines] = useState<string[]>(items ?? []);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  useEffect(() => {
    if (items && items.length > 0) return;

    async function fetchNews() {
      try {
        const res = await fetch(
          `${apiUrl}/api/v1/integrations/news?pageSize=10`,
          {
            headers: screenToken
              ? { Authorization: `Bearer ${screenToken}` }
              : {},
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        const articles = (data.data as NewsItem[]).map((a) => a.title);
        setHeadlines(articles);
      } catch {
        // Ignore
      }
    }

    fetchNews();
    const interval = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [items, apiUrl, screenToken]);

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
        {text || "No headlines available"}
      </div>
    </div>
  );
}
