/**
 * /index — Redirects to the latest monthly Skills Index period.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/admin";

export const revalidate = 3600;

export default async function IndexRedirectPage() {
  const admin = createClient();
  const { data } = await admin
    .from("fp_skill_index_entries")
    .select("period")
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.period) {
    redirect(`/index/${data.period}`);
  }

  // No index entries yet — show a placeholder
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--sg-white)" }}
    >
      <div className="text-center space-y-2">
        <p className="text-sm text-[var(--sg-shell-500)]">
          The AI Skills Index will be published at the start of next month.
        </p>
        <a
          href="/pulse"
          className="text-sm font-medium hover:underline"
          style={{ color: "var(--sg-teal-500)" }}
        >
          View the Skills Pulse instead
        </a>
      </div>
    </div>
  );
}
