import { useRef, useEffect } from "react";

interface VideoZoneProps {
  url: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

export function VideoZone({
  url,
  autoplay = true,
  muted = true,
  loop = false,
}: VideoZoneProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      if (autoplay) {
        videoRef.current.play().catch(() => {
          // Autoplay may be blocked - silently ignore
        });
      }
    }
  }, [url, autoplay]);

  return (
    <video
      ref={videoRef}
      src={url}
      autoPlay={autoplay}
      muted={muted}
      loop={loop}
      playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
