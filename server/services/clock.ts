import { env, isSim } from "../env";
import { getSettings } from "./settings";

/** Real-time → baby-time multiplier. 1 in live mode. */
export const speed = isSim ? env.SIM_SPEED : 1;

export function launchMs(): number | null {
  const l = getSettings().launchAt;
  return l ? new Date(l).getTime() : null;
}

/** Age in (sim-)seconds; null before launch. Can be negative if launch is in the future. */
export function ageAt(nowMs = Date.now()): number | null {
  const l = launchMs();
  if (l === null) return null;
  return ((nowMs - l) / 1000) * speed;
}

export function isBorn(): boolean {
  const a = ageAt();
  return a !== null && a >= 0;
}

/** Current age in whole seconds, or null if not born. */
export function ageS(): number | null {
  const a = ageAt();
  return a === null || a < 0 ? null : Math.floor(a);
}

/** Convert a baby-time duration (seconds) to real milliseconds. */
export function realMs(babySeconds: number): number {
  return (babySeconds * 1000) / speed;
}

export function fmtAge(s: number): string {
  const m = Math.floor(s / 60);
  if (m < 1) return `${Math.floor(s)} seconds`;
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ${m % 60} min`;
  return `${Math.floor(h / 24)} days ${h % 24} hours`;
}
