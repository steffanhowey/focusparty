"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface EnvironmentBackgroundProps {
  imageUrl: string | null;
  overlay: string;
  /** Fallback gradient shown when imageUrl is null. */
  placeholderGradient?: string;
}

export function EnvironmentBackground({
  imageUrl,
  overlay,
  placeholderGradient,
}: EnvironmentBackgroundProps) {
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    setImageReady(false);
  }, [imageUrl]);

  return (
    <div className="absolute inset-0 z-0">
      {/* Base gradient always renders first so the room never flashes empty. */}
      <div
        className="absolute inset-0"
        style={{ background: placeholderGradient ?? "var(--sg-forest-900)" }}
      />

      {imageUrl ? (
        /* Fade the AI background in over the base gradient instead of swapping abruptly. */
        <div
          className={`absolute inset-0 animate-env-drift transition-opacity duration-700 ease-out ${
            imageReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            onLoad={() => setImageReady(true)}
          />
        </div>
      ) : null}

      {/* Readability overlay */}
      <div className="absolute inset-0" style={{ background: overlay }} />

      <style jsx global>{`
        @keyframes env-drift {
          0% {
            transform: scale(1.05) translate(0%, 0%);
          }
          50% {
            transform: scale(1.1) translate(-1%, -0.5%);
          }
          100% {
            transform: scale(1.05) translate(0%, 0%);
          }
        }
        .animate-env-drift {
          animation: env-drift 30s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
