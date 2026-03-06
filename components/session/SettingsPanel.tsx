"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { CHARACTERS } from "@/lib/constants";
import { FlameIcon } from "@/components/ui/FlameIcon";
import type { SessionSettings } from "@/lib/useSettings";
import type { CharacterId } from "@/lib/types";

interface SettingsPanelProps {
  onClose: () => void;
  settings: SessionSettings;
  onUpdateSetting: <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) => void;
}

const CHARACTER_IDS: CharacterId[] = ["ember", "moss", "byte"];

export function SettingsPanel({ onClose, settings, onUpdateSetting }: SettingsPanelProps) {
  // Escape key closes
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-white">Settings</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close settings"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {/* Character */}
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
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all ${
                    selected
                      ? "border-current bg-white/[0.06]"
                      : "border-transparent hover:bg-white/[0.04]"
                  }`}
                  style={{ color: selected ? c.primary : "var(--color-text-tertiary)" }}
                >
                  <FlameIcon character={id} size={24} />
                  <span className="text-xs font-medium">{c.name}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Camera default */}
        <Section label="Camera">
          <Toggle
            checked={settings.cameraDefault === "on"}
            onChange={(v) => onUpdateSetting("cameraDefault", v ? "on" : "off")}
            label="Start camera on by default"
          />
        </Section>

        {/* Sounds */}
        <Section label="Sounds">
          <Toggle
            checked={settings.soundEnabled}
            onChange={(v) => onUpdateSetting("soundEnabled", v)}
            label="Notification sounds"
          />
        </Section>

        {/* Theme */}
        <Section label="Appearance">
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onUpdateSetting("colorMode", mode)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                  settings.colorMode === mode
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-white"
                    : "border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:bg-white/[0.04]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

/* ─── Helpers ───────────────────────────────────────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
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
      className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-white"
    >
      <span>{label}</span>
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-[var(--color-accent-primary)]" : "bg-white/15"
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
