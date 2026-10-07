const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

/** 00D 00H 12M 04S */
export function fmtClock(sec: number | null): string {
  if (sec === null || !isFinite(sec)) return "00D 00H 00M 00S";
  const s = Math.max(0, sec);
  return `${pad(s / 86400)}D ${pad((s % 86400) / 3600)}H ${pad((s % 3600) / 60)}M ${pad(s % 60)}S`;
}

/** compact countdown e.g. 1h 04m 09s */
export function fmtCountdown(sec: number | null): string {
  if (sec === null || !isFinite(sec)) return "—";
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (d) return `${d}d ${pad(h)}h ${pad(m)}m`;
  if (h) return `${h}h ${pad(m)}m ${pad(r)}s`;
  return `${pad(m)}m ${pad(r)}s`;
}

export function fmtT(t: number): string {
  if (t >= 86400) return `DAY ${Math.round(t / 86400)}`;
  if (t >= 3600) return `HOUR ${Math.round(t / 3600)}`;
  return `T+${pad(t / 60)}:${pad(t % 60)}`;
}

export function fmtAgeShort(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${Math.floor(s)}s old`;
  if (s < 3600) return `${Math.floor(s / 60)}m old`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m old`;
}

export function fmtUsd(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (v < 0.01) return `$${v.toPrecision(3)}`;
  return `$${v.toFixed(2)}`;
}

export function fmtSol(v: number | null): string {
  return v === null || v === undefined ? "—" : `${v.toFixed(3)} SOL`;
}

export function shortSig(s: string | null, n = 6): string {
  if (!s) return "—";
  return s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false });
}
