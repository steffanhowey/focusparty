"use client";

import { useEffect, useRef } from "react";

/**
 * Synthesized retro analog TV channel change sound (Web Audio API).
 * Three-layer design replicating the real CRT channel selector:
 *   1. Mechanical relay "thunk" — low-freq transient (80-120 Hz)
 *   2. Static burst — bandpass-filtered noise with sharp attack/decay
 *   3. Contact "click" — very short high-freq impulse at the start
 *
 * Call directly in click handlers for zero-latency playback.
 */
export function playChannelChangeSound(): void {
  try {
    const ctx = new AudioContext();
    const sr = ctx.sampleRate;
    const now = ctx.currentTime;

    // ── Layer 1: Mechanical relay thunk ──
    const thunkLen = Math.floor(sr * 0.08);
    const thunkBuf = ctx.createBuffer(1, thunkLen, sr);
    const thunkData = thunkBuf.getChannelData(0);
    for (let i = 0; i < thunkLen; i++) {
      const t = i / sr;
      // Decaying sine at ~100Hz with a bit of harmonic content
      thunkData[i] =
        Math.sin(2 * Math.PI * 100 * t) * Math.exp(-t * 50) * 0.6 +
        Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 70) * 0.2;
    }
    const thunkSrc = ctx.createBufferSource();
    thunkSrc.buffer = thunkBuf;
    const thunkGain = ctx.createGain();
    thunkGain.gain.value = 0.25;
    thunkSrc.connect(thunkGain);
    thunkGain.connect(ctx.destination);
    thunkSrc.start(now);

    // ── Layer 2: Static burst ──
    const staticLen = Math.floor(sr * 0.4);
    const staticBuf = ctx.createBuffer(1, staticLen, sr);
    const staticData = staticBuf.getChannelData(0);
    for (let i = 0; i < staticLen; i++) {
      const t = i / sr;
      // Sharp attack (first 5ms), then exponential decay
      const attack = Math.min(1, t / 0.005);
      const decay = Math.exp(-t * 6);
      staticData[i] = (Math.random() * 2 - 1) * attack * decay;
    }
    const staticSrc = ctx.createBufferSource();
    staticSrc.buffer = staticBuf;

    // Bandpass to shape the noise like CRT static (~1.5-4.5 kHz)
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2800;
    bp.Q.value = 0.5;

    // High shelf to add some sizzle
    const hiShelf = ctx.createBiquadFilter();
    hiShelf.type = "highshelf";
    hiShelf.frequency.value = 5000;
    hiShelf.gain.value = 3;

    const staticGain = ctx.createGain();
    staticGain.gain.value = 0.18;

    staticSrc.connect(bp);
    bp.connect(hiShelf);
    hiShelf.connect(staticGain);
    staticGain.connect(ctx.destination);
    staticSrc.start(now);

    // ── Layer 3: Contact click ──
    const clickLen = Math.floor(sr * 0.003);
    const clickBuf = ctx.createBuffer(1, clickLen, sr);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) {
      const t = i / sr;
      // Very short impulse decaying fast
      clickData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 1500);
    }
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.35;
    clickSrc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickSrc.start(now);

    // Self-cleanup after longest layer finishes
    staticSrc.onended = () => ctx.close().catch(() => {});
  } catch {
    // Audio not available — silent fallback
  }
}

interface TVStaticOverlayProps {
  label?: string;
  durationMs?: number;
  onComplete: () => void;
}

// ── Helpers ──
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
function fillRandom(arr: Float32Array) {
  for (let i = 0; i < arr.length; i++) arr[i] = Math.random() * 2 - 1;
}

// SMPTE color bars: White, Yellow, Cyan, Green, Magenta, Red, Blue, Black
const SMPTE: [number, number, number][] = [
  [255, 255, 255], [255, 255, 0], [0, 255, 255], [0, 255, 0],
  [255, 0, 255], [255, 0, 0], [0, 0, 255], [0, 0, 0],
];

/**
 * Authentic CRT channel change effect using canvas.
 * Three-phase animation: disruption → tuning chaos → signal lock.
 * SMPTE color bars with vertical roll, horizontal tearing, and colored grain.
 */
export function TVStaticOverlay({
  label,
  durationMs = 1200,
  onComplete,
}: TVStaticOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  // White flash on mount
  useEffect(() => {
    const flash = flashRef.current;
    if (!flash) return;
    flash.style.opacity = "1";
    const t = setTimeout(() => {
      flash.style.opacity = "0";
    }, 60);
    return () => clearTimeout(t);
  }, []);

  // Phased CRT channel change animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 280;
    const h = 158;
    canvas.width = w;
    canvas.height = h;

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    const barWidth = w / SMPTE.length;
    const tearTable = new Float32Array(h);
    fillRandom(tearTable);

    // Pre-generate noise buffer (reused per frame, reshuffled every 3 frames)
    // Avoids 133K Math.random() calls per frame → single buffer rotation
    const NOISE_SIZE = w * h;
    const noiseBuffer = new Uint8Array(NOISE_SIZE);
    for (let i = 0; i < NOISE_SIZE; i++) noiseBuffer[i] = (Math.random() * 255) | 0;

    let raf: number;
    let verticalOffset = 0;
    let frameCount = 0;
    let noiseOffset = 0;
    const startTime = performance.now();

    function draw() {
      const elapsed = performance.now() - startTime;
      const progress = clamp(elapsed / durationMs, 0, 1);

      // ── Phase-dependent parameters ──
      let rollSpeed: number;
      if (elapsed < 200) {
        // Phase 1: fast roll
        rollSpeed = 8;
      } else if (elapsed < 800) {
        // Phase 2: sinusoidal fluctuation
        rollSpeed = 4 + 4 * Math.sin(elapsed * 0.008);
      } else {
        // Phase 3: exponential decay
        rollSpeed = 8 * Math.pow(0.92, (elapsed - 800) / 16.67);
        if (rollSpeed < 0.1) rollSpeed = 0;
      }

      verticalOffset += rollSpeed;

      // Horizontal shift magnitude decays over full duration
      let maxShift = lerp(30, 0, easeOutCubic(progress));
      // Noise grain alpha decays
      let noiseAlpha = lerp(0.4, 0, easeOutCubic(progress));

      // Sync catch moments in Phase 2 — bars briefly snap near-correct
      const inSyncCatch =
        elapsed > 200 && elapsed < 800 && (elapsed % 150 < 50);
      if (inSyncCatch) {
        maxShift *= 0.1;
        noiseAlpha *= 0.3;
      }

      // Reshuffle tear table every 3 frames for stable tearing look
      if (frameCount % 3 === 0) {
        fillRandom(tearTable);
        // Rotate noise offset to simulate fresh noise without re-generating
        noiseOffset = (noiseOffset + 7919) % NOISE_SIZE; // prime stride
      }

      // Retrace bar position (the black band that makes roll visible)
      const retraceY = Math.floor(verticalOffset % h);
      const retraceThickness = Math.max(0, lerp(4, 0, easeOutCubic(progress)));

      // ── Fill ImageData row by row ──
      for (let y = 0; y < h; y++) {
        const rowShift = Math.round(tearTable[y] * maxShift);

        // Is this row part of the retrace bar?
        const distFromRetrace = Math.abs(((y - retraceY) % h + h) % h);
        const inRetrace = distFromRetrace < retraceThickness;

        for (let x = 0; x < w; x++) {
          const srcX = ((x - rowShift) % w + w) % w;
          const barIdx = Math.floor(srcX / barWidth);
          const idx = (y * w + x) * 4;

          if (inRetrace) {
            // Black retrace bar
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
          } else {
            const [br, bg, bb] = SMPTE[clamp(barIdx, 0, 7)];
            const noise = noiseBuffer[(noiseOffset + y * w + x) % NOISE_SIZE];
            // Blend bar color with pre-generated noise
            data[idx] = br * (1 - noiseAlpha) + noise * noiseAlpha;
            data[idx + 1] = bg * (1 - noiseAlpha) + noise * noiseAlpha;
            data[idx + 2] = bb * (1 - noiseAlpha) + noise * noiseAlpha;
          }
          data[idx + 3] = 255;
        }
      }

      ctx!.putImageData(imageData, 0, 0);
      frameCount++;
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  // Complete after duration
  useEffect(() => {
    const t = setTimeout(onComplete, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onComplete]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden bg-black">
      {/* White flash */}
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 bg-white transition-opacity duration-100"
        style={{ opacity: 0 }}
      />

      {/* Noise canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
        }}
      />

      {/* Label */}
      {label && (
        <div className="relative z-10 rounded-lg px-4 py-2 text-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Next up
          </p>
          <p className="mt-0.5 max-w-[240px] text-xs font-medium text-white/90">
            {label}
          </p>
        </div>
      )}
    </div>
  );
}
