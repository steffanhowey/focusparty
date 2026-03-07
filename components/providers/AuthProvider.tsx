"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { AuthState } from "@/lib/types";

interface SignUpMetadata {
  first_name: string;
  last_name: string;
}

interface AuthContextValue {
  authState: AuthState;
  user: SupabaseUser | null;
  signIn: (email: string) => Promise<{ error: string | null }>;
  signUp: (email: string, metadata: SignUpMetadata) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthState(user ? "authenticated" : "anonymous");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthState(session?.user ? "authenticated" : "anonymous");
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = useCallback(
    async (email: string) => {
      setAuthState("loading");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/callback`,
        },
      });
      setAuthState("anonymous");
      return { error: error?.message ?? null };
    },
    [supabase]
  );

  const signUp = useCallback(
    async (email: string, metadata: SignUpMetadata) => {
      setAuthState("loading");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/callback`,
          data: metadata,
        },
      });
      setAuthState("anonymous");
      return { error: error?.message ?? null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    document.cookie = "fp_onboarded=; path=/; max-age=0";
    setUser(null);
    setAuthState("anonymous");
    router.push("/login");
  }, [supabase, router]);

  const value = useMemo<AuthContextValue>(
    () => ({ authState, user, signIn, signUp, signOut }),
    [authState, user, signIn, signUp, signOut]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
