"use client";

import { useState, useCallback } from "react";
import type { CharacterId } from "@/lib/types";

export interface SessionSettings {
  character: CharacterId;
  cameraDefault: "on" | "off";
  soundEnabled: boolean;
  colorMode: "dark" | "light";
  selectedCameraId: string;
  selectedMicrophoneId: string;
  selectedSpeakerId: string;
}

const STORAGE_KEY = "skillgap-settings";
const OLD_STORAGE_KEY = "focusparty-settings";

const DEFAULTS: SessionSettings = {
  character: "ember",
  cameraDefault: "off",
  soundEnabled: true,
  colorMode: "dark",
  selectedCameraId: "",
  selectedMicrophoneId: "",
  selectedSpeakerId: "",
};

function loadSettings(): SessionSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (raw) localStorage.setItem(STORAGE_KEY, raw); // migrate forward
    }
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function persistSettings(settings: SessionSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [settings, setSettings] = useState<SessionSettings>(loadSettings);

  const updateSetting = useCallback(
    <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        persistSettings(next);
        return next;
      });
    },
    []
  );

  return { settings, updateSetting };
}
