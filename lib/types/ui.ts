// UI and toast types

import type { CharacterId } from "./character";

export type ToastType = "info" | "success" | "warning" | "error" | "celebration";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  character?: CharacterId;
}
