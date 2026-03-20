export interface MissionRoomHandoff {
  missionId: string | null;
  missionTitle: string | null;
  missionDomain: string | null;
}

const MISSION_ROOM_HANDOFF_KEY = "fp_room_entry_mission";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function readMissionRoomHandoff(): MissionRoomHandoff | null {
  if (!hasWindow()) return null;

  try {
    const raw = window.sessionStorage.getItem(MISSION_ROOM_HANDOFF_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MissionRoomHandoff> | null;
    const handoff: MissionRoomHandoff = {
      missionId: parsed?.missionId ?? null,
      missionTitle: parsed?.missionTitle ?? null,
      missionDomain: parsed?.missionDomain ?? null,
    };

    if (!handoff.missionId && !handoff.missionTitle && !handoff.missionDomain) {
      return null;
    }

    return handoff;
  } catch {
    return null;
  }
}

export function writeMissionRoomHandoff(
  handoff: MissionRoomHandoff,
): void {
  if (!hasWindow()) return;

  if (!handoff.missionId && !handoff.missionTitle && !handoff.missionDomain) {
    clearMissionRoomHandoff();
    return;
  }

  try {
    window.sessionStorage.setItem(
      MISSION_ROOM_HANDOFF_KEY,
      JSON.stringify(handoff),
    );
  } catch {}
}

export function clearMissionRoomHandoff(): void {
  if (!hasWindow()) return;

  try {
    window.sessionStorage.removeItem(MISSION_ROOM_HANDOFF_KEY);
  } catch {}
}
