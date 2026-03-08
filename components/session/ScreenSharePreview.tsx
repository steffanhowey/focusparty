"use client";

import { useRef, useEffect } from "react";

interface ScreenSharePreviewProps {
  stream: MediaStream;
}

export function ScreenSharePreview({ stream }: ScreenSharePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="h-full w-full object-contain"
    />
  );
}
