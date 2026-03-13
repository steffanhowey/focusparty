"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

// ─── Sync validation ─────────────────────────────────────────

export function validateUsernameFormat(input: string): {
  valid: boolean;
  error?: string;
  normalized: string;
} {
  const normalized = input.toLowerCase().trim();

  if (normalized.length === 0) {
    return { valid: false, error: undefined, normalized };
  }
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return { valid: false, error: "At least 3 characters", normalized };
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return { valid: false, error: "20 characters max", normalized };
  }
  if (!/^[a-z]/.test(normalized)) {
    return { valid: false, error: "Must start with a letter", normalized };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      valid: false,
      error: "Letters, numbers, and underscores only",
      normalized,
    };
  }
  return { valid: true, normalized };
}

// ─── Async availability check ────────────────────────────────

export async function checkUsernameAvailability(
  username: string
): Promise<{ available: boolean; reason?: string }> {
  const res = await fetch(
    `/api/username/check?username=${encodeURIComponent(username)}`
  );
  if (!res.ok) {
    return { available: false, reason: "Failed to check availability" };
  }
  return res.json();
}

// ─── Hook ────────────────────────────────────────────────────

export type UsernameStatus =
  | "idle"
  | "typing"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

export function useUsernameValidation(initialValue = "") {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((raw: string) => {
    // Strip @ prefix if typed, auto-lowercase, no spaces
    const cleaned = raw.replace(/^@/, "").toLowerCase().replace(/\s/g, "");
    setValue(cleaned);

    // Cancel pending checks
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (cleaned.length === 0) {
      setStatus("idle");
      setError(null);
      return;
    }

    // Validate format first
    const { valid, error: formatError } = validateUsernameFormat(cleaned);
    if (!valid) {
      setStatus("invalid");
      setError(formatError ?? "Invalid username");
      return;
    }

    // Format is valid — debounce the availability check
    setStatus("typing");
    setError(null);

    debounceRef.current = setTimeout(async () => {
      setStatus("checking");
      try {
        const result = await checkUsernameAvailability(cleaned);
        // Only apply if value hasn't changed during the check
        setValue((current) => {
          if (current === cleaned) {
            if (result.available) {
              setStatus("available");
              setError(null);
            } else {
              setStatus("taken");
              setError(result.reason ?? "Username is taken");
            }
          }
          return current;
        });
      } catch {
        setValue((current) => {
          if (current === cleaned) {
            setStatus("invalid");
            setError("Failed to check availability");
          }
          return current;
        });
      }
    }, 400);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const isValid = status === "available";

  return { value, setValue: handleChange, status, error, isValid };
}
