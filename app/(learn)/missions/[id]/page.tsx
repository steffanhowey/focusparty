import { MissionDetailPage } from "@/components/missions/MissionDetailPage";

export default async function MissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MissionDetailPage pathId={id} />;
}
