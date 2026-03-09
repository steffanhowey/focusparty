"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "./supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import type { Project } from "./types";
import {
  listProjects,
  createProject as createProjectApi,
  updateProject as updateProjectApi,
  deleteProject as deleteProjectApi,
} from "./projects";

export function useProjects() {
  const { userId } = useCurrentUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchProjects();
  }, [userId, fetchProjects]);

  // Realtime
  useEffect(() => {
    if (!userId) return;

    const client = createClient();
    const channel = client
      .channel("projects-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fp_projects",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchProjects()
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [userId, fetchProjects]);

  const createProject = useCallback(
    async (input: { name: string; color: string; emoji: string }) => {
      if (!userId) return;
      const created = await createProjectApi({
        user_id: userId,
        ...input,
        position: projects.length,
      });
      setProjects((prev) => [...prev, created]);
      return created;
    },
    [userId, projects.length]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      updates: Partial<Pick<Project, "name" | "color" | "emoji" | "position">>
    ) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
      );
      try {
        await updateProjectApi(projectId, updates);
      } catch {
        fetchProjects();
      }
    },
    [fetchProjects]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      try {
        await deleteProjectApi(projectId);
      } catch {
        fetchProjects();
      }
    },
    [fetchProjects]
  );

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    fetchProjects,
  };
}
