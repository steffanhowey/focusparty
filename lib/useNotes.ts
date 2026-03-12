"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { getActiveNote, upsertNote } from "./notes";

interface BreakContext {
  category: string | null;
  contentItemId: string | null;
}

export function useNotes(
  partyId: string,
  sessionId: string | null,
  breakContext?: BreakContext,
) {
  const { userId } = useCurrentUser();
  const [text, setTextState] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Refs for debounce and flush-on-unmount
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const textRef = useRef(text);
  const breakContextRef = useRef(breakContext);
  breakContextRef.current = breakContext;

  // ─── Fetch on mount ──────────────────────────────────────
  useEffect(() => {
    if (!userId || !sessionId) {
      setIsLoaded(true);
      return;
    }

    let cancelled = false;
    setIsLoaded(false);

    getActiveNote(userId, sessionId)
      .then((note) => {
        if (cancelled) return;
        if (note) {
          setTextState(note.note_text);
          textRef.current = note.note_text;
        }
        setIsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, sessionId]);

  // ─── Save helper ─────────────────────────────────────────
  const save = useCallback(
    (value: string) => {
      if (!userId || !sessionId) return;
      pendingRef.current = false;
      setIsSaving(true);

      upsertNote({
        user_id: userId,
        party_id: partyId,
        session_id: sessionId,
        note_text: value,
        break_category: breakContextRef.current?.category,
        content_item_id: breakContextRef.current?.contentItemId,
      })
        .catch(() => {})
        .finally(() => setIsSaving(false));
    },
    [userId, partyId, sessionId],
  );

  // ─── Debounced setText ───────────────────────────────────
  const setText = useCallback(
    (value: string) => {
      setTextState(value);
      textRef.current = value;
      pendingRef.current = true;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => save(value), 1500);
    },
    [save],
  );

  // ─── Flush (blur, unmount, beforeunload) ─────────────────
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      save(textRef.current);
    }
  }, [save]);

  const onBlur = useCallback(() => flush(), [flush]);

  // Flush on unmount
  useEffect(() => {
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush on tab close
  useEffect(() => {
    const handleBeforeUnload = () => flush();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flush]);

  return { text, setText, isSaving, isLoaded, onBlur };
}
