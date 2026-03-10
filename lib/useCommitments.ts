"use client";

import { useState, useCallback } from "react";
import type { CommitmentRecord, CommitmentType, CommitmentStatus } from "./types";
import {
  createCommitment as createCommitmentApi,
  resolveCommitment as resolveCommitmentApi,
  getActiveCommitment as getActiveCommitmentApi,
} from "./commitments";

export function useCommitments() {
  const [activeCommitment, setActiveCommitment] =
    useState<CommitmentRecord | null>(null);

  const createCommitment = useCallback(
    async (input: {
      user_id: string;
      session_goal_id?: string | null;
      session_id?: string | null;
      goal_id?: string | null;
      type: CommitmentType;
    }) => {
      try {
        const commitment = await createCommitmentApi(input);
        setActiveCommitment(commitment);
        return commitment;
      } catch (err) {
        console.error("Failed to create commitment:", err);
        return null;
      }
    },
    []
  );

  const resolveCommitment = useCallback(
    async (status: CommitmentStatus) => {
      if (!activeCommitment) return;
      try {
        await resolveCommitmentApi(activeCommitment.id, status);
        setActiveCommitment((prev) =>
          prev
            ? { ...prev, status, resolved_at: new Date().toISOString() }
            : null
        );
      } catch (err) {
        console.error("Failed to resolve commitment:", err);
      }
    },
    [activeCommitment]
  );

  const fetchActiveCommitment = useCallback(
    async (sessionId: string) => {
      try {
        const c = await getActiveCommitmentApi(sessionId);
        setActiveCommitment(c);
        return c;
      } catch (err) {
        console.error("Failed to fetch active commitment:", err);
        return null;
      }
    },
    []
  );

  const clearCommitment = useCallback(() => {
    setActiveCommitment(null);
  }, []);

  return {
    activeCommitment,
    createCommitment,
    resolveCommitment,
    fetchActiveCommitment,
    clearCommitment,
  };
}
