import { createBrowserClient } from "@supabase/ssr";

// Fallbacks let the client be constructed during static prerendering (when
// env vars may not be injected yet). The client is never *used* during
// prerender — all Supabase calls happen inside useEffect / callbacks.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder"
  );
}
