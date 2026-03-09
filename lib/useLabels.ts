"use client";

import { useState, useCallback, useEffect } from "react";
import { useCurrentUser } from "./useCurrentUser";
import type { Label } from "./types";
import {
  listLabels,
  createLabel as createLabelApi,
  updateLabel as updateLabelApi,
  deleteLabel as deleteLabelApi,
} from "./labels";

export function useLabels() {
  const { userId } = useCurrentUser();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLabels = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listLabels();
      setLabels(data);
    } catch (err) {
      console.error("Failed to fetch labels:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchLabels();
  }, [userId, fetchLabels]);

  const createLabel = useCallback(
    async (input: { name: string; color: string }) => {
      if (!userId) return;
      const created = await createLabelApi({
        user_id: userId,
        ...input,
      });
      setLabels((prev) => [...prev, created]);
      return created;
    },
    [userId]
  );

  const updateLabel = useCallback(
    async (labelId: string, updates: Partial<Pick<Label, "name" | "color">>) => {
      setLabels((prev) =>
        prev.map((l) => (l.id === labelId ? { ...l, ...updates } : l))
      );
      try {
        await updateLabelApi(labelId, updates);
      } catch {
        fetchLabels();
      }
    },
    [fetchLabels]
  );

  const deleteLabel = useCallback(
    async (labelId: string) => {
      setLabels((prev) => prev.filter((l) => l.id !== labelId));
      try {
        await deleteLabelApi(labelId);
      } catch {
        fetchLabels();
      }
    },
    [fetchLabels]
  );

  return {
    labels,
    loading,
    createLabel,
    updateLabel,
    deleteLabel,
    fetchLabels,
  };
}
