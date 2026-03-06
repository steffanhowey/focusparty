"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type { AuthState, User } from "@/lib/types";

interface AuthContextValue {
  authState: AuthState;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("anonymous");
  const [user, setUser] = useState<User | null>(null);

  const signIn = useCallback(async (_email: string, _password: string) => {
    setAuthState("loading");
    // Stub: no-op, keep anonymous
    setAuthState("anonymous");
  }, []);

  const signOut = useCallback(async () => {
    setAuthState("anonymous");
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    // Stub: no-op
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      user,
      signIn,
      signOut,
      refreshSession,
    }),
    [authState, user, signIn, signOut, refreshSession]
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
