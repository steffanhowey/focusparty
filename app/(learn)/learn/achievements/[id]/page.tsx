import { redirect } from "next/navigation";
import { getProgressEvidenceRoute } from "@/lib/appRoutes";

export default async function LegacyAchievementRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(getProgressEvidenceRoute(id));
}
