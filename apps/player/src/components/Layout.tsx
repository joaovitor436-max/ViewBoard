import type { Playlist } from "@/store/playerStore";
import { PlaylistRunner } from "./PlaylistRunner";

interface LayoutProps {
  playlist: Playlist;
}

export function Layout({ playlist }: LayoutProps) {
  const { layout, items } = playlist;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {layout.zones.map((zone) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${zone.x}%`,
          top: `${zone.y}%`,
          width: `${zone.width}%`,
          height: `${zone.height}%`,
          zIndex: zone.zIndex,
          overflow: "hidden",
        };

        const zoneItems = items.filter((item) => item.zoneId === zone.id);

        return (
          <PlaylistRunner
            key={zone.id}
            zoneId={zone.id}
            items={zoneItems}
            style={style}
          />
        );
      })}
    </div>
  );
}
