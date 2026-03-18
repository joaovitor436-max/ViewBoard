import { AnimatePresence, motion } from "framer-motion";
import { usePlaylist } from "@/hooks/usePlaylist";
import { ImageZone } from "./zones/ImageZone";
import { VideoZone } from "./zones/VideoZone";
import { ClockZone } from "./zones/ClockZone";
import { WeatherZone } from "./zones/WeatherZone";
import { TickerZone } from "./zones/TickerZone";
import { AnnouncementZone } from "./zones/AnnouncementZone";
import type { PlaylistItem } from "@/store/playerStore";
import { usePlayerStore } from "@/store/playerStore";

interface PlaylistRunnerProps {
  zoneId: string;
  items: PlaylistItem[];
  style?: React.CSSProperties;
}

function ContentRenderer({ item }: { item: PlaylistItem }) {
  const { screenToken } = usePlayerStore();
  const { content } = item;
  const body = (content.body ?? {}) as Record<string, unknown>;

  switch (content.type) {
    case "IMAGE":
      return (
        <ImageZone
          url={content.url ?? ""}
          objectFit={(body["objectFit"] as "cover" | "contain") ?? "cover"}
        />
      );

    case "VIDEO":
      return (
        <VideoZone
          url={content.url ?? ""}
          muted={(body["muted"] as boolean) ?? true}
          loop={(body["loop"] as boolean) ?? false}
        />
      );

    case "CLOCK":
      return (
        <ClockZone
          timezone={(body["timezone"] as string) ?? undefined}
          showSeconds={(body["showSeconds"] as boolean) ?? true}
          format={(body["format"] as "12h" | "24h") ?? "24h"}
          showDate={(body["showDate"] as boolean) ?? true}
        />
      );

    case "WEATHER_WIDGET":
      return (
        <WeatherZone
          city={(body["city"] as string) ?? "São Paulo"}
          screenToken={screenToken ?? undefined}
        />
      );

    case "TICKER":
      return (
        <TickerZone
          items={body["items"] as string[] | undefined}
          screenToken={screenToken ?? undefined}
          speed={(body["speed"] as number) ?? 80}
        />
      );

    case "ANNOUNCEMENT":
      return (
        <AnnouncementZone
          title={(body["title"] as string) ?? content.name}
          body={(body["body"] as string) ?? undefined}
          backgroundColor={(body["backgroundColor"] as string) ?? undefined}
          textColor={(body["textColor"] as string) ?? undefined}
        />
      );

    case "HTML":
      return (
        <iframe
          srcDoc={content.url ?? (body["html"] as string) ?? ""}
          style={{ width: "100%", height: "100%", border: "none" }}
          sandbox="allow-scripts allow-same-origin"
        />
      );

    default:
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
          }}
        >
          {content.type}
        </div>
      );
  }
}

export function PlaylistRunner({ zoneId, items, style }: PlaylistRunnerProps) {
  const { currentItem } = usePlaylist(items, zoneId);

  if (!currentItem) {
    return (
      <div
        style={{
          ...style,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#333",
          fontSize: "0.75rem",
        }}
      >
        No content
      </div>
    );
  }

  return (
    <div style={{ ...style, overflow: "hidden", position: "relative" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{ position: "absolute", inset: 0 }}
        >
          <ContentRenderer item={currentItem} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
