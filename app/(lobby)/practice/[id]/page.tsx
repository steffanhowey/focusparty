import { redirect } from "next/navigation";
import { getRoomRoute } from "@/lib/appRoutes";

export default async function PracticeRoomRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(getRoomRoute(id));
}
