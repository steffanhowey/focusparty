"use client";

interface FocusSurfaceProps {
  roomName: string;
  goal: string;
}

export function FocusSurface({ roomName, goal }: FocusSurfaceProps) {
  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center pb-32">
      {/* Room name (subtle) */}
      <p className="mb-2 text-sm font-medium tracking-wide text-white/40">
        {roomName}
      </p>

      {/* Goal / task (primary) */}
      <h1 className="max-w-xl text-center text-3xl font-bold text-white drop-shadow-lg">
        {goal}
      </h1>
    </div>
  );
}
