"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "./supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_style_version: number | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  onboarding_completed: boolean;
}

const PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, avatar_seed, avatar_style_version, email, first_name, last_name, onboarding_completed";

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = user?.id ?? null;

  const fetchProfile = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("fp_profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (signal?.cancelled) return;

    if (error) {
      console.error("[useProfile] Fetch failed:", error);
    }

    setProfile((data as Profile) ?? null);
    setLoading(false);
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    const signal = { cancelled: false };
    fetchProfile(signal);
    return () => { signal.cancelled = true; };
  }, [fetchProfile]);

  // Realtime subscription for profile changes
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`fp_profiles:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fp_profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { profile, loading, refetch: fetchProfile };
}
