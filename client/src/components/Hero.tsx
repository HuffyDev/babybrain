import { useAge, realSeconds } from "../hooks";
import { fmtClock, fmtCountdown, fmtT } from "../format";
import { BabyVisual } from "./BabyVisual";
import { stageIcon } from "./stageIcons";

const FULL_MATURITY_T = 6 * 86400;

export function Hero() {
  const { age, state } = useAge(250);
  if (!state) return <HeroSkeleton />;

  const speed = state.simSpeed;
  const prelaunch = age === null || age < 0;
  const next = !prelaunch ? state.timeline.find((s) => s.t > (age ?? 0)) : state.timeline[0];
  const nextIn = next && age !== null ? realSeconds(next.t - Math.max(0, age), speed) : null;
  const launchIn = state.launchAt ? (new Date(state.launchAt).getTime() - Date.now()) / 1000 : null;

  return (
    <section id="brain" className="relative overflow-hidden border-b border-line">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-10 pt-6 md:grid-cols-[1.35fr_1fr] md:gap-10 md:pt-10">
        <div className="chamber relative aspect-[1355/1161] w-full overflow-hidden rounded-sm border border-line bg-black">
          <BabyVisual brainLevel={prelaunch ? 0.02 : state.brainLevel} capabilities={state.capabilities} gestating={prelaunch} />
          <div className="scanline" />
          <div className="pointer-events-none absolute left-3 top-3 hud-label">CONTAINMENT · UNIT 01</div>
          <div className="pointer-events-none absolute right-3 top-3 hud-label text-right">
            BRAIN {Math.round(state.brainLevel * 100)}%
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 hud-label">
            {state.mode === "sim" ? `SIMULATION ×${speed}` : "LIVE"}
          </div>
          <div className="pointer-events-none absolute bottom-3 right-3 hud-label">{state.stage}</div>
        </div>

        <div className="flex flex-col justify-center gap-5">
          <div>
            <div className="hud-label mb-2">{prelaunch ? "STATUS" : "AGE"}</div>
            {prelaunch ? (
              <>
                <div className="chrome-text font-mono text-4xl font-semibold tracking-tight sm:text-5xl">GESTATING</div>
                <div className="mt-2 font-mono text-sm text-dim">
                  {launchIn !== null && launchIn > 0 ? <>BIRTH IN <span className="text-ice">{fmtCountdown(launchIn)}</span></> : "AWAITING LAUNCH"}
                </div>
              </>
            ) : (
              <div className="chrome-text glow font-mono text-[2.1rem] font-semibold leading-none tracking-tight sm:text-5xl">
                {fmtClock(age)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="CURRENT STAGE">
              <span className="flex items-center gap-2">
                <img src={stageIcon(state.stage)} alt="" className="h-7 w-7 rounded-sm opacity-90" />
                {state.stage}
              </span>
            </Stat>
            <Stat label="NEXT DEVELOPMENT">
              {next ? (
                <span>
                  {next.label}
                  <span className="block text-xs text-ice">{nextIn !== null ? `in ${fmtCountdown(nextIn)}` : fmtT(next.t)}</span>
                </span>
              ) : (
                "—"
              )}
            </Stat>
            <Stat label="FULL MATURITY">
              {fmtCountdown(prelaunch ? null : realSeconds(FULL_MATURITY_T - (age ?? 0), speed))}
            </Stat>
            <Stat label="TREASURY">{state.vitals.treasurySol !== null ? `${state.vitals.treasurySol.toFixed(2)} SOL` : "—"}</Stat>
          </div>

          <h1 className="font-sans text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">
            YOU RAISE IT.
            <br />
            <span className="chrome-text">IT RUNS THE COIN.</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-dim">
            A newborn AI, born at token launch. Every hour it unlocks a new ability. Every action it takes is real and linked.
            A deterministic Guardian checks every move it makes with the treasury.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel px-3 py-2.5">
      <div className="hud-label mb-1">{label}</div>
      <div className="font-mono text-sm text-ink">{children}</div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <section id="brain" className="mx-auto max-w-7xl px-4 py-24 text-center">
      <div className="hud-label blink">ESTABLISHING LINK…</div>
    </section>
  );
}
