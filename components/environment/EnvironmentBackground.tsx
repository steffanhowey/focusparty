"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

interface EnvironmentBackgroundProps {
  imageUrl: string;
  overlay: string;
}

export function EnvironmentBackground({
  imageUrl,
  overlay,
}: EnvironmentBackgroundProps) {
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => setLoaded(true), []);

  return (
    <div className="absolute inset-0 z-0">
      {/* Ken Burns animated image — fades in when loaded */}
      <div
        className="absolute inset-0 animate-env-drift transition-opacity duration-700 ease-out"
        style={{ opacity: loaded ? 1 : 0 }}
      >
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          onLoad={handleLoad}
        />
      </div>

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
        @keyframes env-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-env-fade-in {
          animation: env-fade-in 0.5s ease-out both;
        }
      `}</style>
    </div>
  );
}
