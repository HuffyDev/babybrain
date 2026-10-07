import { useState } from "react";
import { useStore } from "../store";
import { useAge, realSeconds } from "../hooks";
import { fmtAgeShort, fmtCountdown, fmtSol, fmtT, fmtUsd, shortSig, timeOf } from "../format";
import { stageIcon } from "./stageIcons";

// stable fallback: a fresh [] per call would loop useSyncExternalStore
const EMPTY: never[] = [];

function Section({ id, title, children, right }: { id?: string; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="section-title">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <div className="panel px-4 py-6 font-mono text-xs text-mute">{children}</div>;

// ── 2. Development bars ─────────────────────────────────────────────────────
export function DevBars() {
  const bars = useStore((s) => s.state?.bars ?? EMPTY);
  return (
    <Section title="Development">
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {bars.map((b) => (
          <div key={b.key}>
            <div className="mb-1.5 flex justify-between font-mono text-[11px]">
              <span className="tracking-widest text-chrome">{b.label}</span>
              <span className="text-dim">
                {b.detail} · <span className="text-ink">{Math.round(b.value * 100)}%</span>
              </span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
              <div className="bar-fill h-full rounded-full" style={{ width: `${Math.max(1, b.value * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── 3. Anatomy ──────────────────────────────────────────────────────────────
export function Anatomy() {
  const { age, state } = useAge(1000);
  if (!state) return null;
  return (
    <Section title="Anatomy">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {state.anatomy.map((a) => {
          const until = a.unlockAt !== null && age !== null ? realSeconds(a.unlockAt - Math.max(0, age), state.simSpeed) : null;
          return (
            <div key={a.key} className={`panel px-3 py-3 ${a.active ? "border-ice/40 shadow-[0_0_24px_-8px_rgba(159,216,255,0.5)]" : ""}`}>
              <div className="font-mono text-xs tracking-widest text-ink">{a.label}</div>
              <div className={`mt-1 font-mono text-[11px] ${a.active ? "text-ice" : "text-mute"}`}>
                {a.active ? "● ACTIVE" : until !== null && until > 0 ? `LOCKED · ${fmtCountdown(until)}` : "LOCKED"}
              </div>
              {a.capabilities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.capabilities.map((c) => (
                    <span key={c} className={`font-mono text-[9px] ${state.capabilities[c] ? "text-chrome" : "text-mute line-through decoration-mute/40"}`}>
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── 6. Action log ───────────────────────────────────────────────────────────
export function ActionLog() {
  const actions = useStore((s) => s.state?.actions ?? EMPTY);
  return (
    <Section id="actions" title="Action Log" right={<span className="hud-label">every row links to proof</span>}>
      {actions.length === 0 ? (
        <Empty>no actions yet</Empty>
      ) : (
        <div className="panel divide-y divide-line overflow-hidden">
          {actions.map((a) => {
            const link = a.proofUrl ?? a.xUrl;
            return (
              <div key={a.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 font-mono text-[12px]">
                <span className="text-mute">{timeOf(a.ts)}</span>
                <span className="min-w-0">
                  <span className="mr-2 text-mint">{a.type}</span>
                  {a.amountSol !== null && <span className="mr-2 text-ink">{fmtSol(a.amountSol)}</span>}
                  <span className={a.status === "CONFIRMED" ? "text-dim" : a.status === "FAILED" ? "text-alarm" : "text-amber"}>{a.status}</span>
                  {a.summary && <span className="block truncate text-dim">{a.summary}</span>}
                </span>
                {link ? (
                  <a href={link} target="_blank" rel="noreferrer" className="text-ice underline decoration-ice/40 underline-offset-2">
                    {a.txSig ? shortSig(a.txSig, 4) : "post"} ↗
                  </a>
                ) : (
                  <span className="text-mute">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ── 7. Proposals ────────────────────────────────────────────────────────────
export function Proposals() {
  const proposals = useStore((s) => s.state?.proposals ?? EMPTY);
  return (
    <Section title="Proposals · Guardian">
      {proposals.length === 0 ? (
        <Empty>decision making unlocks at T+22:00</Empty>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {proposals.map((p) => {
            const color = p.status === "REJECTED" || p.status === "FAILED" ? "text-alarm" : p.status === "PENDING" ? "text-amber" : "text-mint";
            return (
              <div key={p.id} className="panel px-4 py-3 font-mono text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink">
                    #{String(p.id).padStart(3, "0")} {p.type} {fmtSol(p.amount)}
                  </span>
                  <span className={color}>{p.status}</span>
                </div>
                <div className="mt-1 text-dim">confidence {(p.confidence * 100).toFixed(0)}%</div>
                <ul className="mt-2 list-inside list-disc text-chrome">
                  {p.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                {p.guardianResult && (
                  <div className="mt-2 border-t border-line pt-2 text-salmon">
                    GUARDIAN: {p.guardianResult} — {p.guardianReason}
                    {p.maxAllowed !== null && p.guardianResult === "REJECTED" && <span className="text-dim"> · max allowed {fmtSol(p.maxAllowed)}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ── 8. Timeline ─────────────────────────────────────────────────────────────
export function Timeline() {
  const { age, state } = useAge(1000);
  const [showAll, setShowAll] = useState(false);
  if (!state) return null;
  const hour = state.timeline.filter((s) => s.t <= 3600);
  const days = state.timeline.filter((s) => s.t > 3600);
  const visibleHour = showAll ? hour : hour.filter((s, i) => s.fired || i < 4 || (age !== null && s.t <= age + 600));

  return (
    <Section title="Development Timeline">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <ol className="panel divide-y divide-line">
          {visibleHour.map((s) => {
            const until = age !== null ? realSeconds(s.t - Math.max(0, age), state.simSpeed) : null;
            return (
              <li key={s.id} className="grid grid-cols-[64px_18px_1fr_auto] items-start gap-2 px-3 py-2 font-mono text-[12px]">
                <span className="text-mute">{fmtT(s.t)}</span>
                <span className={s.fired ? "text-ice" : "text-mute"}>{s.fired ? (s.skipped ? "↷" : "✓") : "○"}</span>
                <span className="min-w-0">
                  <span className={s.fired ? "text-ink" : "text-dim"}>{s.label}</span>
                  <span className="block text-[11px] text-mute">{s.description}</span>
                </span>
                <span className="text-right text-[11px] text-dim">
                  {s.fired ? (s.unlocks.length ? s.unlocks.join(" ") : "") : until !== null && until > 0 ? fmtCountdown(until) : ""}
                </span>
              </li>
            );
          })}
          {!showAll && (
            <li className="px-3 py-2">
              <button onClick={() => setShowAll(true)} className="font-mono text-[11px] text-ice">
                show full first hour ↓
              </button>
            </li>
          )}
        </ol>
        <div>
          <div className="hud-label mb-2">LOCKED DEVELOPMENT</div>
          <ol className="grid gap-2">
            {days.map((s) => {
              const until = age !== null ? realSeconds(s.t - Math.max(0, age), state.simSpeed) : null;
              return (
                <li key={s.id} className="panel flex items-center gap-3 px-3 py-2 font-mono text-[12px]">
                  <img src={stageIcon(s.stage)} alt="" className="h-9 w-9 rounded-sm opacity-60 grayscale-[30%]" />
                  <span className="min-w-0 flex-1">
                    <span className="text-dim">{fmtT(s.t)}</span> <span className="text-ink">{s.label}</span>
                    <span className="block text-[11px] text-mute">
                      {s.description} · {s.unlocks.join(", ")}
                    </span>
                  </span>
                  <span className="text-right text-[11px]">
                    <span className="block text-mute">LOCKED</span>
                    <span className="text-ice">{until !== null && until > 0 ? fmtCountdown(until) : s.wired ? "" : "awaiting wiring"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Section>
  );
}

// ── 9. Memories + People ────────────────────────────────────────────────────
export function MemoriesPeople() {
  const memories = useStore((s) => s.state?.memories ?? EMPTY);
  const people = useStore((s) => s.state?.people ?? EMPTY);
  const slang = useStore((s) => s.state?.slang ?? EMPTY);
  return (
    <>
      <Section id="memories" title="Memories">
        {memories.length === 0 ? (
          <Empty>long-term memory unlocks at T+14:00</Empty>
        ) : (
          <div className="terminal-scroll panel max-h-[380px] divide-y divide-line overflow-y-auto">
            {memories.map((m) => (
              <div key={m.id} className="px-3 py-2 font-mono text-[12px]">
                <span className="mr-2 text-ice">{m.kind}</span>
                <span className="text-ink">{m.content}</span>
                <span className="mt-0.5 block text-[10px] text-mute">
                  {fmtAgeShort(m.ageS)}
                  {m.userHandle && ` · @${m.userHandle}`}
                  {m.tags.length > 0 && ` · ${m.tags.join(" ")}`}
                </span>
              </div>
            ))}
          </div>
        )}
        {slang.length > 0 && (
          <div className="mt-4">
            <div className="hud-label mb-2">WORDS LEARNED</div>
            <div className="flex flex-wrap gap-2">
              {slang.map((w) => (
                <span key={w.term} title={w.definition} className="panel px-2 py-1 font-mono text-[11px] text-chrome">
                  {w.term}
                  <span className="ml-1 text-mute">{fmtAgeShort(w.learnedAtAgeS)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>
      <Section id="people" title="People I Know">
        {people.length === 0 ? (
          <Empty>recognises people from T+14:00</Empty>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full font-mono text-[12px]">
              <thead>
                <tr className="text-left text-mute">
                  <th className="px-3 py-2 font-normal">HANDLE</th>
                  <th className="px-3 py-2 font-normal">INTERACTIONS</th>
                  <th className="px-3 py-2 font-normal">FIRST MET</th>
                  <th className="px-3 py-2 font-normal">RELATIONSHIP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {people.map((p) => (
                  <tr key={`${p.platform}:${p.handle}`}>
                    <td className="px-3 py-2 text-ink">
                      @{p.handle} <span className="text-mute">{p.platform}</span>
                    </td>
                    <td className="px-3 py-2 text-chrome">{p.interactions}</td>
                    <td className="px-3 py-2 text-dim">at {fmtAgeShort(p.firstSeenAgeS).replace(" old", "")}</td>
                    <td className="px-3 py-2 text-dim">{p.relationshipSummary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

// ── 10. Vital signs ─────────────────────────────────────────────────────────
export function Vitals() {
  const { age, state } = useAge(1000);
  if (!state) return null;
  const v = state.vitals;
  const items: [string, string][] = [
    ["AGE", fmtAgeShort(age !== null && age >= 0 ? age : null)],
    ["MCAP", fmtUsd(v.mcapUsd)],
    ["LIQUIDITY", fmtUsd(v.liquidityUsd)],
    ["HOLDERS", v.holders?.toLocaleString() ?? "—"],
    ["TREASURY", fmtSol(v.treasurySol)],
    ["MENTIONS", v.mentions.toLocaleString()],
    ["MEMORIES", v.memories.toLocaleString()],
    ["WORDS LEARNED", v.wordsLearned.toLocaleString()],
  ];
  return (
    <Section id="treasury" title="Vital Signs">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([k, val]) => (
          <div key={k} className="panel px-3 py-3">
            <div className="hud-label">{k}</div>
            <div className="mt-1 font-mono text-lg text-ink">{val}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── 11. Token ───────────────────────────────────────────────────────────────
export function Token() {
  const token = useStore((s) => s.state?.token);
  const [copied, setCopied] = useState(false);
  if (!token) return null;
  const ca = token.mint;
  return (
    <Section id="token" title="Token">
      <div className="panel flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="hud-label mb-1">CONTRACT ADDRESS {token.symbol && `· $${token.symbol}`}</div>
          <div className="break-all font-mono text-sm text-ink">{ca ?? "revealed at birth"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!ca}
            onClick={() => {
              if (!ca) return;
              navigator.clipboard?.writeText(ca).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="rounded-sm border border-ice/60 px-3 py-1.5 font-mono text-[11px] text-ice disabled:opacity-30"
          >
            {copied ? "COPIED" : "COPY CA"}
          </button>
          {token.xHandle && <Ext href={`https://x.com/${token.xHandle}`}>X</Ext>}
          {ca && <Ext href={`https://dexscreener.com/solana/${ca}`}>DEXSCREENER</Ext>}
          {ca && <Ext href={`https://pump.fun/coin/${ca}`}>PUMP.FUN</Ext>}
          {ca && <Ext href={`https://solscan.io/token/${ca}`}>SOLSCAN</Ext>}
        </div>
      </div>
    </Section>
  );
}

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="rounded-sm border border-line2 px-3 py-1.5 font-mono text-[11px] text-chrome hover:border-ice/60 hover:text-ice">
    {children} ↗
  </a>
);
