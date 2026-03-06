"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useCurrentUser() {
  const { user, authState } = useAuth();
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
    displayName:
      user?.user_metadata?.display_name ??
      user?.email?.split("@")[0] ??
      "Guest",
    email: user?.email ?? null,
    isAuthenticated: authState === "authenticated",
    isLoading: authState === "loading",
    requireAuth,
  };
}
