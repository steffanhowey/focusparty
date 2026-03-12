"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type { TaskRecord } from "@/lib/types";
import type { ExternalWorkItem } from "./types";

/**
 * Fetches external work items (GitHub issues, Linear issues, etc.)
 * from all connected task-source providers.
 *
 * Items are fetched once on mount and can be manually refreshed.
 * The "import" action creates a local fp_tasks row + fp_linked_resources cache
 * so the sprint machinery only ever sees fp_tasks.
 *
 * Pass `tasks` to automatically filter out items that are already imported.
 */
export function useExternalItems(tasks?: TaskRecord[]) {
  const { userId } = useCurrentUser();
  const [items, setItems] = useState<ExternalWorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const fetched = useRef(false);

  const fetchItems = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Fetch from all connected providers in parallel
      const results = await Promise.allSettled([
        fetch("/api/integrations/github/items").then(async (res) => {
          if (!res.ok) return [];
          const data = await res.json();
          return (data.items ?? []) as ExternalWorkItem[];
        }),
        // Future: linear, etc.
      ]);

      const merged: ExternalWorkItem[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          merged.push(...result.value);
        }
      }

      setItems(merged);
    } catch (err) {
      console.error("[useExternalItems] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch once on mount
  useEffect(() => {
    if (!userId || fetched.current) return;
    fetched.current = true;
    fetchItems();
  }, [userId, fetchItems]);

  /**
   * Import an external item as a local fp_task.
   * Creates a linked_resources cache row, then a task pointing at it.
   * Returns the new task ID on success, null on failure.
   */
  const importItem = useCallback(
    async (item: ExternalWorkItem): Promise<string | null> => {
      if (!userId) return null;
      setImporting(item.externalId);

      try {
        const res = await fetch("/api/integrations/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item }),
        });

        if (!res.ok) {
          console.error("[useExternalItems] Import failed:", await res.text());
          return null;
        }

        const { taskId } = await res.json();

        // Remove from external items list (it's now a local task)
        setItems((prev) =>
          prev.filter((i) => i.externalId !== item.externalId)
        );

        return taskId;
      } catch (err) {
        console.error("[useExternalItems] Import error:", err);
        return null;
      } finally {
        setImporting(null);
      }
    },
    [userId]
  );

  // Filter out items that are already imported as local tasks
  const linkedExternalIds = useMemo(() => {
    if (!tasks) return new Set<string>();
    return new Set(
      tasks
        .filter((t) => t.linked_resource?.external_id)
        .map((t) => t.linked_resource!.external_id)
    );
  }, [tasks]);

  const unimportedItems = useMemo(
    () => items.filter((i) => !linkedExternalIds.has(i.externalId)),
    [items, linkedExternalIds]
  );

  return {
    /** External items not yet imported as local tasks */
    items: unimportedItems,
    /** Whether items are being fetched */
    loading,
    /** The externalId currently being imported, or null */
    importing,
    /** Import an external item as a local task */
    importItem,
    /** Re-fetch items from all providers */
    refresh: fetchItems,
  };
}
