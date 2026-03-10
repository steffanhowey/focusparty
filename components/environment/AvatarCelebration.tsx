"use client";

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

interface AvatarCelebrationProps {
  color: string; // tone color hex
}

/**
 * Radial particle burst + expanding ring overlay.
 * Rendered absolutely on top of a participant avatar.
 * All animation is CSS-only — no JS loops.
 */
export function AvatarCelebration({ color }: AvatarCelebrationProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Expanding ring */}
      <div
        className="fp-burst-ring absolute inset-0 rounded-full"
        style={{
          border: `2px solid ${color}`,
          animation: "fp-burst-ring 1.4s ease-out forwards",
        }}
      />

      {/* 8 radial particles */}
      {ANGLES.map((angle, i) => (
        <div
          key={angle}
          className="fp-burst-particle absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            backgroundColor: color,
            "--angle": `${angle}deg`,
            animation: `fp-burst-particle 1.2s ease-out ${i * 30}ms forwards`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
