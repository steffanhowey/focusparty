"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

/* ─── Config ──────────────────────────────────────────────── */

const INHALE_MS = 3500;
const EXHALE_MS = 2500;
const TOTAL_BREATHS = 3;
const PETAL_COUNT = 6;

// Petal angles — evenly spaced around 360°
const PETAL_ANGLES = Array.from(
  { length: PETAL_COUNT },
  (_, i) => i * (360 / PETAL_COUNT)
);

// Petal opacities — slight variation for visual depth
const PETAL_OPACITIES = [0.55, 0.45, 0.55, 0.4, 0.5, 0.45];

/* ─── Props ───────────────────────────────────────────────── */

interface BreathingOverlayProps {
  isOpen: boolean;
  goalText: string;
  onComplete: () => void;
}

/* ─── Component ───────────────────────────────────────────── */

export function BreathingOverlay({ isOpen, goalText, onComplete }: BreathingOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [breath, setBreath] = useState(0);
  const [phase, setPhase] = useState<"inhale" | "exhale" | "done">("inhale");
  const [launching, setLaunching] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setBreath(0);
      setPhase("inhale");
      setLaunching(false);
      setExiting(false);
      startedRef.current = false;
    }
  }, [isOpen]);

  // Breathing cycle engine
  useEffect(() => {
    if (!isOpen || exiting || phase === "done") return;

    // Prevent double-start in strict mode
    if (startedRef.current && breath === 0 && phase === "inhale") return;
    startedRef.current = true;

    const duration = phase === "inhale" ? INHALE_MS : EXHALE_MS;

    timerRef.current = setTimeout(() => {
      if (phase === "inhale") {
        setPhase("exhale");
      } else {
        const next = breath + 1;
        if (next >= TOTAL_BREATHS) {
          setPhase("done");
        } else {
          setBreath(next);
          setPhase("inhale");
        }
      }
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, breath, phase, exiting]);

  const handleExit = useCallback((skipBurst: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (skipBurst) {
      // Quick fade for skip — still a moment, just briefer
      setExiting(true);
      setTimeout(onComplete, 350);
    } else {
      // Full launch: mandala bursts outward, glow intensifies, then fades
      setLaunching(true);
      setTimeout(() => {
        setExiting(true);
        setTimeout(onComplete, 300);
      }, 400);
    }
  }, [onComplete]);

  const handleLetsGo = useCallback(() => handleExit(false), [handleExit]);
  const handleSkip = useCallback(() => handleExit(true), [handleExit]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  /* ── Derived values ── */

  const isInhale = phase === "inhale";
  const isDone = phase === "done";

  // Mandala: blooms on inhale, gathers on exhale, rests when done
  const spread = isInhale ? 42 : 0; // px — how far petals move outward
  const containerScale = isInhale ? 1 : 0.6;
  const breathRotation = (breath * 30) + (isInhale ? 30 : 0); // rotates 30° per half-cycle

  const animDuration = isDone ? "0.8s" : isInhale ? `${INHALE_MS}ms` : `${EXHALE_MS}ms`;
  const animEasing = isInhale
    ? "cubic-bezier(0.4, 0.0, 0.2, 1)"
    : "cubic-bezier(0.0, 0.0, 0.2, 1)";

  const cueText = isDone
    ? "You're ready"
    : isInhale
      ? "Breathe in"
      : "Breathe out";

  // Background glow intensity — intensifies during launch burst
  const glowRadius = launching ? "60%" : isInhale ? "45%" : "25%";
  const glowOpacity = launching ? 0.2 : isInhale ? 0.08 : 0.03;

  /* ── Render ── */

  const content = (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center transition-opacity ${
        exiting ? "opacity-0 duration-300" : "opacity-100 duration-400"
      }`}
      style={{ zIndex: 45, background: "#080a15" }}
      role="status"
      aria-live="polite"
      aria-label="Breathing exercise"
    >
      {/* Background ambient glow — breathes with you, bursts on launch */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle, rgba(83, 90, 238, ${glowOpacity}) 0%, transparent ${glowRadius})`,
          transition: launching
            ? "background 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
            : `background ${animDuration} ${animEasing}`,
        }}
      />

      {/* Goal text — reinforces intention, fades during launch */}
      {goalText && (
        <p
          className="absolute top-16 left-1/2 -translate-x-1/2 text-center text-sm text-[#888995] transition-opacity duration-300"
          style={{
            animation: "fp-breathe-fade-in 0.8s ease 0.3s both",
            opacity: launching ? 0 : undefined,
          }}
        >
          Focusing on: <span className="text-[#c3c4ca]">{goalText}</span>
        </p>
      )}

      {/* Mandala */}
      <div
        className="relative"
        style={{ width: 400, height: 400 }}
      >
        {/* Slow continuous rotation wrapper */}
        <div
          className="fp-breathe-mandala absolute inset-0"
          style={{
            animation: "fp-breathe-rotate 60s linear infinite",
          }}
        >
          {/* Breathing scale + rotation — bursts outward on launch */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: launching ? undefined : `scale(${containerScale}) rotate(${breathRotation}deg)`,
              transition: launching ? undefined : `transform ${animDuration} ${animEasing}`,
              animation: launching
                ? "fp-breathe-launch 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                : "fp-breathe-appear 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            {/* 6 petals */}
            {PETAL_ANGLES.map((angle, i) => (
              <div
                key={i}
                className="fp-breathe-petal absolute rounded-full"
                style={{
                  width: 130,
                  height: 130,
                  background: `radial-gradient(circle at 40% 40%, rgba(83, 90, 238, ${PETAL_OPACITIES[i]}) 0%, rgba(83, 90, 238, 0.08) 100%)`,
                  mixBlendMode: "screen",
                  // Double-rotate: position along angle, then un-rotate to stay upright
                  transform: `rotate(${angle}deg) translateY(${-spread}px) rotate(${-angle}deg)`,
                  transition: `transform ${animDuration} ${animEasing}`,
                }}
              />
            ))}

            {/* Center glow — bright core where petals overlap */}
            <div
              className="absolute rounded-full"
              style={{
                width: 60,
                height: 60,
                background: "radial-gradient(circle, rgba(83, 90, 238, 0.6) 0%, rgba(83, 90, 238, 0.1) 100%)",
                boxShadow: `0 0 ${isInhale ? 60 : 30}px rgba(83, 90, 238, ${isInhale ? 0.4 : 0.15})`,
                transition: `box-shadow ${animDuration} ${animEasing}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Text cue + progress — fades during launch */}
      <div
        className="mt-12 flex flex-col items-center gap-4 transition-opacity duration-300"
        style={{ opacity: launching ? 0 : 1 }}
      >
        <p
          key={`${phase}-${breath}`}
          className={`text-xl font-semibold ${isDone ? "text-white" : "text-[#c3c4ca]"}`}
          style={{
            fontFamily: "var(--font-montserrat), sans-serif",
            animation: isDone
              ? "fp-breathe-fade-in 0.5s ease forwards"
              : `fp-breathe-text-enter ${isInhale ? `${INHALE_MS}ms` : `${EXHALE_MS}ms`} ease forwards`,
          }}
        >
          {cueText}
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-3">
          {Array.from({ length: TOTAL_BREATHS }, (_, i) => {
            const completed = isDone || i < breath;
            const active = !isDone && i === breath;
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-500"
                style={{
                  width: 8,
                  height: 8,
                  background: completed
                    ? "#535aee"
                    : active
                      ? "rgba(83, 90, 238, 0.45)"
                      : "rgba(255, 255, 255, 0.1)",
                  boxShadow: completed
                    ? "0 0 8px rgba(83, 90, 238, 0.5)"
                    : "none",
                }}
              />
            );
          })}
        </div>

        {/* "Let's go" button — appears after final exhale */}
        {isDone && (
          <button
            type="button"
            onClick={handleLetsGo}
            data-autofocus
            className="mt-4 cursor-pointer rounded-full bg-[#535aee] px-10 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#4636d3] hover:shadow-[0_0_24px_rgba(83,90,238,0.4)]"
            style={{
              fontFamily: "var(--font-montserrat), sans-serif",
              animation: "fp-breathe-fade-in 0.5s ease 0.15s both",
            }}
          >
            Let's go
          </button>
        )}
      </div>

      {/* Skip — hidden during launch */}
      {!launching && (
        <button
          type="button"
          onClick={handleSkip}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer text-xs text-[#555] transition-colors hover:text-[#888995]"
        >
          Skip
        </button>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
