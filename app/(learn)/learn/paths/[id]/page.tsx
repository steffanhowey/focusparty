import { redirect } from "next/navigation";
import { getMissionRoute } from "@/lib/appRoutes";

export default async function LegacyLearnPathRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(getMissionRoute(id));
}
