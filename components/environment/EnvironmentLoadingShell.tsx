import { EnvironmentBackground } from "./EnvironmentBackground";

interface EnvironmentLoadingShellProps {
  imageUrl?: string | null;
  overlay: string;
  placeholderGradient?: string;
}

export function EnvironmentLoadingShell({
  imageUrl = null,
  overlay,
  placeholderGradient,
}: EnvironmentLoadingShellProps) {
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-forest-900">
      <EnvironmentBackground
        imageUrl={imageUrl}
        overlay={overlay}
        placeholderGradient={placeholderGradient}
      />

      <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-full flex-col items-center gap-4 px-4 pb-24 pt-20">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-2"
          >
            <div className="h-16 w-16 rounded-full border border-white/[0.12] bg-white/[0.08] backdrop-blur-[8px]" />
            <div className="h-3 w-12 rounded-full bg-white/[0.10]" />
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col pl-24">
        <header className="relative z-10 -ml-24 flex items-center gap-3 py-4 pl-4 pr-4">
          <div className="flex h-11 min-w-[220px] items-center rounded-full border border-white/[0.12] bg-white/[0.08] px-4 backdrop-blur-[12px]">
            <div className="h-4 w-4 rounded-full bg-white/[0.16]" />
            <div className="ml-3 h-4 w-40 rounded-full bg-white/[0.14]" />
          </div>
        </header>
        <div className="flex-1" />
      </div>
    </div>
  );
}
