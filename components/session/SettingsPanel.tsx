"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Camera, Mic, Volume2, ChevronDown } from "lucide-react";
import { PanelHeader } from "./PanelHeader";
import { CHARACTERS } from "@/lib/constants";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { useMediaDevices } from "@/lib/useMediaDevices";
import type { SessionSettings } from "@/lib/useSettings";
import type { CharacterId } from "@/lib/types";

/* ─── Types & constants ──────────────────────────────────── */

type SettingsSection = "audio-video" | "user-preferences" | "background-effects";

const CHARACTER_IDS: CharacterId[] = ["ember", "moss", "byte"];

interface SettingsPanelProps {
  onClose: () => void;
  settings: SessionSettings;
  onUpdateSetting: <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) => void;
}

/* ─── Root ───────────────────────────────────────────────── */

export const SettingsPanel = memo(function SettingsPanel({ onClose, settings, onUpdateSetting }: SettingsPanelProps) {
  const [openSection, setOpenSection] = useState<SettingsSection | null>("audio-video");

  const toggle = (id: SettingsSection) =>
    setOpenSection((prev) => (prev === id ? null : id));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <PanelHeader title="Settings" onClose={onClose} />

      {/* Accordion sections */}
      <div className="fp-shell-scroll flex-1 overflow-y-auto">
        <Accordion label="Audio & video" isOpen={openSection === "audio-video"} onToggle={() => toggle("audio-video")}>
          <AudioVideoContent settings={settings} onUpdateSetting={onUpdateSetting} />
        </Accordion>

        <Accordion label="User preferences" isOpen={openSection === "user-preferences"} onToggle={() => toggle("user-preferences")}>
          <UserPreferencesContent settings={settings} onUpdateSetting={onUpdateSetting} />
        </Accordion>

        <Accordion label="Background effects" isOpen={openSection === "background-effects"} onToggle={() => toggle("background-effects")}>
          <p className="text-sm text-[var(--sg-shell-500)]">Coming soon.</p>
        </Accordion>
      </div>
    </>
  );
});

/* ─── Accordion ──────────────────────────────────────────── */

function Accordion({
  label,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--sg-shell-200)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.04]"
      >
        {label}
        <ChevronDown
          size={15}
          strokeWidth={2}
          className={`text-[var(--sg-shell-500)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ─── Audio & Video Content ──────────────────────────────── */

function AudioVideoContent({
  settings,
  onUpdateSetting,
}: {
  settings: SessionSettings;
  onUpdateSetting: SettingsPanelProps["onUpdateSetting"];
}) {
  const { cameras, microphones, speakers, refresh } = useMediaDevices();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const stopPreview = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startPreview = useCallback(
    async (deviceId?: string) => {
      stopPreview();
      const id = ++requestIdRef.current;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
          audio: false,
        });
        // Stale request (strict-mode remount) or unmounted — kill immediately
        if (!mountedRef.current || id !== requestIdRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        refresh();
      } catch {
        // Permission denied or device unavailable
      }
    },
    [stopPreview, refresh]
  );

  useEffect(() => {
    mountedRef.current = true;
    startPreview(settings.selectedCameraId || undefined);
    return () => {
      mountedRef.current = false;
      requestIdRef.current++;   // invalidate any in-flight getUserMedia
      stopPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCameraChange = (deviceId: string) => {
    onUpdateSetting("selectedCameraId", deviceId);
    startPreview(deviceId);
  };

  const handleTestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: settings.selectedMicrophoneId
          ? { deviceId: { exact: settings.selectedMicrophoneId } }
          : true,
      });
      setTimeout(() => stream.getTracks().forEach((t) => t.stop()), 3000);
    } catch {
      // Permission denied
    }
  };

  const handleTestSpeaker = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 500);
    } catch {
      // Audio not available
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera preview */}
      <div className="overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 10" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      <DeviceSelector
        icon={<Camera size={16} strokeWidth={1.8} />}
        label="Camera"
        devices={cameras}
        selectedId={settings.selectedCameraId}
        onChange={handleCameraChange}
      />

      <DeviceSelector
        icon={<Mic size={16} strokeWidth={1.8} />}
        label="Microphone"
        devices={microphones}
        selectedId={settings.selectedMicrophoneId}
        onChange={(id) => onUpdateSetting("selectedMicrophoneId", id)}
        action={{ label: "Test your mic", onClick: handleTestMic }}
      />

      <DeviceSelector
        icon={<Volume2 size={16} strokeWidth={1.8} />}
        label="Speakers"
        devices={speakers}
        selectedId={settings.selectedSpeakerId}
        onChange={(id) => onUpdateSetting("selectedSpeakerId", id)}
        action={{ label: "Play test sound", onClick: handleTestSpeaker }}
      />
    </div>
  );
}

/* ─── Device Selector ────────────────────────────────────── */

function DeviceSelector({
  icon,
  label,
  devices,
  selectedId,
  onChange,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  devices: { deviceId: string; label: string }[];
  selectedId: string;
  onChange: (deviceId: string) => void;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          {icon} {label}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-xs text-[var(--sg-forest-400)] transition-colors hover:text-white hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="relative">
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-full border border-[var(--sg-shell-border)] bg-white/[0.06] px-4 py-2 pr-8 text-sm text-[var(--sg-shell-600)] transition-colors hover:border-[var(--sg-forest-400)] focus:border-[var(--sg-forest-400)] focus:outline-none"
        >
          {devices.length === 0 && <option value="">No devices found</option>}
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--sg-shell-500)]"
        />
      </div>
    </div>
  );
}

/* ─── User Preferences Content ───────────────────────────── */

function UserPreferencesContent({
  settings,
  onUpdateSetting,
}: {
  settings: SessionSettings;
  onUpdateSetting: SettingsPanelProps["onUpdateSetting"];
}) {
  return (
    <div className="space-y-5">
      <Section label="Character">
        <div className="grid grid-cols-3 gap-2">
          {CHARACTER_IDS.map((id) => {
            const c = CHARACTERS[id];
            const selected = settings.character === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onUpdateSetting("character", id)}
                className={`flex flex-col items-center gap-1.5 rounded-full border px-2 py-3 transition-all ${
                  selected
                    ? "border-current bg-white/[0.06]"
                    : "border-transparent hover:bg-white/[0.04]"
                }`}
                style={{ color: selected ? c.primary : "var(--sg-shell-500)" }}
              >
                <FlameIcon character={id} size={24} />
                <span className="text-xs font-medium">{c.name}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Camera">
        <Toggle
          checked={settings.cameraDefault === "on"}
          onChange={(v) => onUpdateSetting("cameraDefault", v ? "on" : "off")}
          label="Start camera on by default"
        />
      </Section>

      <Section label="Sounds">
        <Toggle
          checked={settings.soundEnabled}
          onChange={(v) => onUpdateSetting("soundEnabled", v)}
          label="Notification sounds"
        />
      </Section>

      <Section label="Appearance">
        <div className="flex gap-2">
          {(["dark", "light"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onUpdateSetting("colorMode", mode)}
              className={`flex-1 rounded-full border px-3 py-2 text-xs font-medium capitalize transition-all ${
                settings.colorMode === mode
                  ? "border-[var(--sg-forest-400)] bg-[var(--sg-forest-400)]/10 text-white"
                  : "border-[var(--sg-shell-200)] text-[var(--sg-shell-500)] hover:bg-white/[0.04]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm text-[var(--sg-shell-600)] transition-colors hover:text-white"
    >
      <span>{label}</span>
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-[var(--sg-forest-500)]" : "bg-white/15"
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}
