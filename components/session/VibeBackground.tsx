"use client";

import { useState, useEffect, useRef, memo } from "react";
import { type VibeId, VIBE_BACKGROUNDS } from "@/lib/musicConstants";

interface VibeBackgroundProps {
  activeVibe: VibeId;
}

export const VibeBackground = memo(function VibeBackground({
  activeVibe,
}: VibeBackgroundProps) {
  const [showLayerA, setShowLayerA] = useState(true);
  const [layerAVibe, setLayerAVibe] = useState<VibeId>(activeVibe);
  const [layerBVibe, setLayerBVibe] = useState<VibeId>(activeVibe);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Set the new background on the HIDDEN layer, then swap visibility
    if (showLayerA) {
      setLayerBVibe(activeVibe);
      requestAnimationFrame(() => setShowLayerA(false));
    } else {
      setLayerAVibe(activeVibe);
      requestAnimationFrame(() => setShowLayerA(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVibe]);

  const layerStyle = (vibeId: VibeId): React.CSSProperties => {
    const bg = VIBE_BACKGROUNDS[vibeId];
    const hasImage = bg.imageUrl.length > 0;
    return {
      position: "absolute",
      inset: 0,
      backgroundImage: hasImage ? `url(${bg.imageUrl})` : bg.fallbackGradient,
      backgroundSize: "cover",
      backgroundPosition: "center",
      filter: "none",
      transform: "none",
    };
  };

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        opacity: 1,
      }}
    >
      <div
        style={{
          ...layerStyle(layerAVibe),
          opacity: showLayerA ? 1 : 0,
          transition: "opacity 1.5s ease-in-out",
        }}
      />
      <div
        style={{
          ...layerStyle(layerBVibe),
          opacity: showLayerA ? 0 : 1,
          transition: "opacity 1.5s ease-in-out",
        }}
      />
    </div>
  );
});
