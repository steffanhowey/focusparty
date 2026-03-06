"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export function useTimer(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearTimeout(id);
  }, [running, seconds]);

  const formatted = useMemo(
    () =>
      `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`,
    [seconds]
  );

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback((s: number) => {
    setSeconds(s);
    setRunning(false);
  }, []);

  return { seconds, formatted, running, start, pause, reset };
}
