import { Component, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import type { Capability } from "@shared/types";
import { useStore } from "../store";
import { REGIONS } from "./regions";

const ParticleBaby = lazy(() => import("./ParticleBaby"));

/** Decide up front whether this device should even try WebGL. */
function canRender3D(): { ok: boolean; maxPoints: number } {
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return { ok: false, maxPoints: 0 };
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return { ok: false, maxPoints: 0 };
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 4;
    if (cores <= 2 || mem <= 1) return { ok: false, maxPoints: 0 };
    const mobile = matchMedia("(max-width: 768px)").matches;
    return { ok: true, maxPoints: mobile || cores <= 4 || mem <= 2 ? 9000 : 22000 };
  } catch {
    return { ok: false, maxPoints: 0 };
  }
}

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Static({ gestating, brainLevel }: { gestating: boolean; brainLevel: number }) {
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

export function BabyVisual({ brainLevel, capabilities, gestating }: { brainLevel: number; capabilities: Record<Capability, boolean>; gestating: boolean }) {
  const caps = useMemo(canRender3D, []);
  const [lowFps, setLowFps] = useState(false);
  const onLowFps = useCallback(() => setLowFps(true), []);
  const lastUnlock = useStore((s) => s.lastUnlock);
  const active = REGIONS.map((r) => (r.caps.some((c) => capabilities[c as Capability]) ? 1 : 0));
  const fallback = <Static gestating={gestating} brainLevel={brainLevel} />;

  return (
    <>
      {gestating || !caps.ok || lowFps ? (
        fallback
      ) : (
        <GLBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <ParticleBaby level={brainLevel} active={active} burstKey={lastUnlock?.at ?? 0} maxPoints={caps.maxPoints} onLowFps={onLowFps} />
          </Suspense>
        </GLBoundary>
      )}
      {!gestating &&
        REGIONS.map((r, i) => (
          <div
            key={r.key}
            className="pointer-events-none absolute font-mono text-[8px] tracking-[0.2em] transition-opacity duration-1000 sm:text-[9px]"
            style={{
              left: `${r.u * 100}%`,
              top: `${r.v * 100}%`,
              transform: `translate(${r.labelDx}px, ${r.labelDy}px)`,
              opacity: active[i] ? 0.85 : 0.18,
              color: active[i] ? "#9fd8ff" : "#565d66",
            }}
          >
            <span className="mr-1 inline-block h-px w-3 align-middle" style={{ background: "currentColor" }} />
            {r.key}
          </div>
        ))}
    </>
  );
}
