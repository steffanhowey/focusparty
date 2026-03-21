"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "./useProfile";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useCurrentUser() {
  const { user, authState } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();

  const requireAuth = useCallback(
    (returnTo?: string) => {
      if (!user) {
        const loginUrl = returnTo
          ? `/login?next=${encodeURIComponent(returnTo)}`
          : "/login";
        router.push(loginUrl);
        return false;
      }
      return true;
    },
    [user, router]
  );

  return {
    userId: user?.id ?? null,
    profile,
    displayName:
      profile?.display_name ??
      user?.user_metadata?.display_name ??
      user?.email?.split("@")[0] ??
      "Guest",
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    primaryFunction: profile?.primary_function ?? null,
    fluencyLevel: profile?.fluency_level ?? null,
    email: user?.email ?? null,
    isAuthenticated: authState === "authenticated",
    isLoading: authState === "loading" || profileLoading,
    requireAuth,
  };
}
