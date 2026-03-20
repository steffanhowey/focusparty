"use client";

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
  return (
    <div className="absolute inset-0 z-0">
      {imageUrl ? (
        /* Ken Burns animated image */
        <div className="absolute inset-0 animate-env-drift">
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ) : (
        /* Gradient placeholder when no AI background is available */
        <div
          className="absolute inset-0"
          style={{ background: placeholderGradient ?? "var(--sg-forest-900)" }}
        />
      )}

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
