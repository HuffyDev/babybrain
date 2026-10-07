import type { Capability } from "@shared/types";

/** Static fallback (also the low-end path once the particle renderer lands in step 7). */
export function BabyVisual({ brainLevel, gestating }: { brainLevel: number; capabilities: Record<Capability, boolean>; gestating: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <img
        src={gestating ? "/stages/gestating.png" : "/baby.png"}
        alt="Baby Brain"
        className="baby-fallback h-full w-full object-contain"
        style={{ opacity: gestating ? 0.6 : 0.35 + brainLevel * 0.65 }}
      />
    </div>
  );
}
