"use client";

import { useState, useCallback } from "react";
import type { CharacterId } from "@/lib/types";

export interface SessionSettings {
  character: CharacterId;
  cameraDefault: "on" | "off";
  soundEnabled: boolean;
  colorMode: "dark" | "light";
}

const STORAGE_KEY = "focusparty-settings";

const DEFAULTS: SessionSettings = {
  character: "ember",
  cameraDefault: "off",
  soundEnabled: true,
  colorMode: "dark",
};

function loadSettings(): SessionSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
