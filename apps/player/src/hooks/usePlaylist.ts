import { useState, useEffect, useRef, useCallback } from "react";
import type { PlaylistItem } from "@/store/playerStore";

/**
 * Returns the currently active content item per zone,
 * cycling through items according to their durationSec.
 */
export function usePlaylist(items: PlaylistItem[], zoneId: string) {
  const zoneItems = items
    .filter((item) => item.zoneId === zoneId)
    .sort((a, b) => a.order - b.order);

  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(zoneItems.length, 1));
  }, [zoneItems.length]);

  useEffect(() => {
    if (zoneItems.length === 0) return;

    const current = zoneItems[currentIndex];
    if (!current) return;

    const duration = (current.durationSec ?? current.content.durationSec) * 1000;

    timerRef.current = setTimeout(advance, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, zoneItems, advance]);

  // Reset when items change (new playlist)
  useEffect(() => {
    setCurrentIndex(0);
  }, [items]);

  const current = zoneItems[currentIndex] ?? null;

  return {
    currentItem: current,
    totalItems: zoneItems.length,
    currentIndex,
  };
}
