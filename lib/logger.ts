// ─── Structured Logger ──────────────────────────────────────
// Lightweight wrapper around console.* that adds timestamps,
// structured context, and consistent formatting.
//
// Usage:
//   import { logger } from "@/lib/logger";
//   const log = logger("learn/search");
//   log.info("cache hit", { query, results: 5 });
//   log.error("generation failed", error, { query });
//   log.warn("slow query", { durationMs: 1200 });
//
// In Vercel serverless, console.* is captured by the platform.
// This logger enriches those logs with structure, not replaces them.

export interface Logger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * Create a scoped logger for a module or route.
 *
 * @param scope - Module identifier, e.g. "learn/search", "breaks/discovery"
 */
export function logger(scope: string): Logger {
  const prefix = `[${scope}]`;

  return {
    info(message: string, context?: Record<string, unknown>): void {
      if (context && Object.keys(context).length > 0) {
        console.log(prefix, message, formatContext(context));
      } else {
        console.log(prefix, message);
      }
    },

    warn(message: string, context?: Record<string, unknown>): void {
      if (context && Object.keys(context).length > 0) {
        console.warn(prefix, message, formatContext(context));
      } else {
        console.warn(prefix, message);
      }
    },

    error(message: string, error?: unknown, context?: Record<string, unknown>): void {
      const errorInfo = extractError(error);
      const merged = { ...errorInfo, ...context };

      if (Object.keys(merged).length > 0) {
        console.error(prefix, message, formatContext(merged));
      } else {
        console.error(prefix, message);
      }
    },

    debug(message: string, context?: Record<string, unknown>): void {
      if (process.env.NODE_ENV !== "production") {
        if (context && Object.keys(context).length > 0) {
          console.debug(prefix, message, formatContext(context));
        } else {
          console.debug(prefix, message);
        }
      }
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────

/** Extract structured info from an error object. */
function extractError(error: unknown): Record<string, unknown> {
  if (!error) return {};

  if (error instanceof Error) {
    const info: Record<string, unknown> = {
      error_name: error.name,
      error_message: error.message,
    };
    // Include stack in non-production for debugging
    if (process.env.NODE_ENV !== "production" && error.stack) {
      info.stack = error.stack.split("\n").slice(0, 5).join("\n");
    }
    // Supabase errors often have a `code` property
    if ("code" in error) {
      info.error_code = (error as { code: unknown }).code;
    }
    return info;
  }

  if (typeof error === "string") {
    return { error_message: error };
  }

  return { error_raw: String(error) };
}

/** Format context as a JSON string for log output. */
function formatContext(context: Record<string, unknown>): string {
  try {
    return JSON.stringify(context);
  } catch {
    return "[unserializable context]";
  }
}
