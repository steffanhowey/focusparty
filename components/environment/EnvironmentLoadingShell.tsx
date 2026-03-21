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

      <div className="absolute inset-0 bg-shell-900/20 backdrop-blur-[2px]" aria-hidden />

      <div className="relative z-10 flex h-full items-center justify-center p-4">
        <div
          className="w-full max-w-[520px] overflow-hidden rounded-xl"
          style={{
            background: "rgba(15,35,24,0.84)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "var(--shadow-xl)",
          }}
          aria-hidden="true"
        >
          <div className="flex gap-4 p-6 pb-0">
            <div className="h-[110px] w-[150px] shrink-0 animate-pulse rounded-md bg-white/[0.08]" />

            <div className="min-w-0 flex-1 py-0.5">
              <div className="h-6 w-40 animate-pulse rounded bg-white/[0.12]" />

              <div className="mt-2 space-y-2">
                <div className="h-3 w-full max-w-[16rem] animate-pulse rounded bg-white/[0.08]" />
                <div className="h-3 w-full max-w-[13rem] animate-pulse rounded bg-white/[0.06]" />
                <div className="h-3 w-full max-w-[10rem] animate-pulse rounded bg-white/[0.06]" />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-3 w-14 animate-pulse rounded bg-white/[0.08]" />
                <div className="h-3 w-10 animate-pulse rounded bg-white/[0.06]" />
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="h-[26px] w-[26px] animate-pulse rounded-full bg-white/[0.08]"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mx-5 mt-4 border-t border-white/[0.06]" />

          <div className="relative h-[168px]">
            <div className="px-5 pt-4">
              <div className="mb-2 h-4 w-44 animate-pulse rounded bg-white/[0.10]" />
              <div className="h-10 w-full animate-pulse rounded-full bg-white/[0.08]" />
              <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
            </div>

            <div className="absolute bottom-5 right-5 h-9 w-24 animate-pulse rounded-[var(--sg-radius-btn)] bg-white/[0.10]" />
          </div>
        </div>
      </div>
    </div>
  );
}
