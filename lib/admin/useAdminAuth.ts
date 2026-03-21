"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AdminAuthState {
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Client-side hook that verifies admin status.
 * Redirects non-admins to /party.
 */
export function useAdminAuth(): AdminAuthState {
  const router = useRouter();
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: false,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/admin/auth");
        const data = await res.json();

        if (cancelled) return;

        if (!data.isAdmin) {
          router.replace("/missions");
          return;
        }

        setState({ isAdmin: true, isLoading: false });
      } catch {
        if (!cancelled) {
          router.replace("/missions");
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return state;
}
