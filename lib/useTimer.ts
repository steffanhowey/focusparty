"use client";

import { useRef, useCallback, useEffect, useSyncExternalStore } from "react";

function formatTime(s: number): string {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export interface TimerSnapshot {
  seconds: number;
  running: boolean;
  formatted: string;
}

export type Timer = ReturnType<typeof useTimer>;

export function useTimer(initialSeconds: number, onComplete?: () => void) {
  const secondsRef = useRef(initialSeconds);
  const runningRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listenersRef = useRef(new Set<() => void>());
  const snapshotRef = useRef<TimerSnapshot>({
    seconds: initialSeconds,
    running: false,
    formatted: formatTime(initialSeconds),
  });
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const notify = useCallback(() => {
    snapshotRef.current = {
      seconds: secondsRef.current,
      running: runningRef.current,
      formatted: formatTime(secondsRef.current),
    };
    listenersRef.current.forEach((l) => l());
  }, []);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (secondsRef.current > 0) {
        secondsRef.current -= 1;
        notify();
        if (secondsRef.current <= 0) {
          runningRef.current = false;
          clearTick();
          notify();
          onCompleteRef.current?.();
        }
      }
    }, 1000);
  }, [notify, clearTick]);

  const start = useCallback(() => {
    runningRef.current = true;
    startTick();
    notify();
  }, [startTick, notify]);

  const pause = useCallback(() => {
    runningRef.current = false;
    clearTick();
    notify();
  }, [clearTick, notify]);

  const reset = useCallback(
    (s: number) => {
      secondsRef.current = s;
      runningRef.current = false;
      clearTick();
      notify();
    },
    [clearTick, notify]
  );

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  // Clean up interval on unmount to prevent leaked timers
  useEffect(() => () => clearTick(), [clearTick]);

  return { subscribe, getSnapshot, start, pause, reset };
}

/** Call in any component that needs to read the timer display. */
export function useTimerDisplay(timer: Timer): TimerSnapshot {
  return useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
}
