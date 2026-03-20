import { AnimatePresence, motion } from "framer-motion";
import type { Playlist, DeviceLayout, LayoutConfig } from "@/store/playerStore";
import { usePlayerStore, DEFAULT_LAYOUT } from "@/store/playerStore";
import { PlaylistRunner } from "./PlaylistRunner";
import { WidgetRenderer } from "./WidgetRenderer";

interface LayoutProps {
  playlist: Playlist;
}

export function Layout({ playlist }: LayoutProps) {
  const deviceLayout = usePlayerStore((s) => s.deviceLayout);
  const activeLayout: DeviceLayout = deviceLayout ?? DEFAULT_LAYOUT;
  const { config, zones } = activeLayout;
  const { items } = playlist;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeLayout.template}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: "100vw",
          height: "100vh",
          position: "relative",
          backgroundColor: config.backgroundColor,
          fontFamily: config.fontFamily,
          fontSize: `${config.fontSize}px`,
          overflow: "hidden",
        }}
      >
        {/* Logo no canto superior esquerdo */}
        {config.logoUrl && (
          <div
            style={{
              position: "absolute",
              top: "1rem",
              left: "1rem",
              zIndex: 100,
            }}
          >
            <img
              src={config.logoUrl}
              alt="Logo"
              style={{
                height: "3rem",
                width: "auto",
                objectFit: "contain",
                opacity: 0.9,
              }}
            />
          </div>
        )}

        {/* Renderizar cada zona */}
        {zones.map((zone) => {
          const style: React.CSSProperties = {
            position: "absolute",
            left: `${zone.x}%`,
            top: `${zone.y}%`,
            width: `${zone.width}%`,
            height: `${zone.height}%`,
            zIndex: zone.zIndex,
            overflow: "hidden",
          };

          // Zona de mídia: renderiza items da playlist
          if (zone.role === "media" || !zone.role) {
            const zoneItems = items.filter((item) => item.zoneId === zone.id);
            // Se não há items nesta zona, tentar items da zona "main"
            const effectiveItems = zoneItems.length > 0
              ? zoneItems
              : items.filter((item) => item.zoneId === "main");

            return (
              <PlaylistRunner
                key={zone.id}
                zoneId={zone.id}
                items={effectiveItems}
                style={style}
              />
            );
          }

          // Zona de widget: renderiza widgets configurados
          return (
            <WidgetRenderer
              key={zone.id}
              zoneId={zone.id}
              config={config}
              style={style}
            />
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
