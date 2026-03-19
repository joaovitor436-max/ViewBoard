"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Pause, Play, SkipForward, SkipBack, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

interface PreviewItem {
  id: string;
  order: number;
  type: string;
  name: string;
  url: string | null;
  thumbnailUrl?: string | null;
  body?: unknown;
  durationSec: number;
}

interface PlaylistPreview {
  id: string;
  name: string;
  items: PreviewItem[];
}

export function PlaylistPreviewModal({
  playlistId,
  onClose,
}: {
  playlistId: string;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data } = useQuery({
    queryKey: ["playlist-preview", playlistId],
    queryFn: () =>
      api.get<{ data: PlaylistPreview }>(`/playlists/${playlistId}/preview`),
  });

  const items = data?.data?.items ?? [];
  const currentItem = items[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
    setProgress(0);
  }, [items.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    setProgress(0);
  }, [items.length]);

  // Auto-advance timer
  useEffect(() => {
    if (!currentItem || isPaused || items.length === 0) return;

    const durationMs = (currentItem.durationSec ?? 10) * 1000;
    const intervalMs = 100;
    let elapsed = 0;

    // For videos, let the video element control timing if it has a src
    if (currentItem.type === "VIDEO" && currentItem.url) {
      // Video handles its own timing via onEnded
      return;
    }

    timerRef.current = setInterval(() => {
      elapsed += intervalMs;
      setProgress((elapsed / durationMs) * 100);

      if (elapsed >= durationMs) {
        goNext();
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, currentItem, isPaused, items.length, goNext]);

  // Handle video ended
  const handleVideoEnded = useCallback(() => {
    goNext();
  }, [goNext]);

  // Reset video when index changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      if (!isPaused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [currentIndex, isPaused]);

  // Video progress
  useEffect(() => {
    if (!currentItem || currentItem.type !== "VIDEO" || !videoRef.current) return;

    const video = videoRef.current;
    const update = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    video.addEventListener("timeupdate", update);
    return () => video.removeEventListener("timeupdate", update);
  }, [currentItem, currentIndex]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev]);

  // Pause/resume video when isPaused changes
  useEffect(() => {
    if (videoRef.current && currentItem?.type === "VIDEO") {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, currentItem]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  if (!data?.data || items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-lg mb-4">
            {!data ? "Carregando preview..." : "Playlist sem itens para exibir"}
          </p>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/50 text-white z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{data.data.name}</span>
          <span className="text-xs text-white/60">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {currentItem?.type === "VIDEO" && currentItem.url ? (
          <video
            ref={videoRef}
            key={`video-${currentIndex}`}
            src={currentItem.url}
            autoPlay={!isPaused}
            muted
            onEnded={handleVideoEnded}
            className="max-w-full max-h-full object-contain"
          />
        ) : currentItem?.type === "IMAGE" && currentItem.url ? (
          <img
            key={`img-${currentIndex}`}
            src={currentItem.url}
            alt={currentItem.name}
            className="max-w-full max-h-full object-contain"
          />
        ) : currentItem?.type === "ANNOUNCEMENT" && currentItem.body ? (
          <div className="flex items-center justify-center w-full h-full p-12">
            <div
              className="rounded-2xl p-12 text-center max-w-2xl"
              style={{
                backgroundColor:
                  (currentItem.body as Record<string, string>)?.backgroundColor ?? "#1e40af",
                color:
                  (currentItem.body as Record<string, string>)?.textColor ?? "#ffffff",
              }}
            >
              <h2 className="text-4xl font-bold mb-4">
                {(currentItem.body as Record<string, string>)?.title}
              </h2>
              <p className="text-xl">
                {(currentItem.body as Record<string, string>)?.message}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-white text-center">
            <p className="text-xl font-medium">{currentItem?.name}</p>
            <p className="text-sm text-white/60 mt-1">{currentItem?.type}</p>
          </div>
        )}

        {/* Item name overlay */}
        <div className="absolute bottom-16 left-0 right-0 text-center">
          <span className="bg-black/50 text-white text-sm px-3 py-1 rounded-full">
            {currentItem?.name}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/50 px-4 py-3 z-10">
        {/* Progress bar */}
        <div className="w-full h-1 bg-white/20 rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
            onClick={goPrev}
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 h-10 w-10 rounded-full"
            onClick={() => setIsPaused((p) => !p)}
          >
            {isPaused ? (
              <Play className="h-6 w-6" />
            ) : (
              <Pause className="h-6 w-6" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
            onClick={goNext}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
