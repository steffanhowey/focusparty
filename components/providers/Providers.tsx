"use client";

import { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { ThemeProvider } from "./ThemeProvider";
import { NotificationProvider } from "./NotificationProvider";
import { SyntheticAvatarPreloader } from "./SyntheticAvatarPreloader";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <SyntheticAvatarPreloader />
          {children}
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
