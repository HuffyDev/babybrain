import { useEffect, useMemo, useRef, useState } from "react";
import type { EventType, PublicEvent, Source } from "@shared/types";
import { useStore } from "../store";
import { timeOf } from "../format";

export const TYPE_COLOR: Record<EventType, string> = {
  BIRTH: "#ffffff",
  SYSTEM: "#7d8590",
  LEARN: "#8fd3ff",
  MEMORY: "#b9c7d6",
  SOCIAL: "#6fe3ff",
  MARKET: "#f2d18b",
  DECISION: "#e6f4ff",
  GUARDIAN: "#ffb4a2",
  ACTION: "#a6f0c6",
  DEVELOPMENT: "#c8e6ff",
  WARNING: "#ff6b6b",
  CHAT: "#d7dde4",
};

export function SourceBadge({ source }: { source: Source }) {
  const cls: Record<Source, string> = {
    BABY: "bg-ice/90 text-black border-ice",
    SYSTEM: "text-dim border-line2",
    GUARDIAN: "text-salmon border-salmon/50",
    HUMAN: "bg-alarm text-black border-alarm",
  };
  return <span className={`inline-block shrink-0 self-start mt-[3px] rounded-[2px] border px-1 py-px font-mono text-[9px] leading-none tracking-wider ${cls[source]}`}>{source}</span>;
}

const ALL: EventType[] = Object.keys(TYPE_COLOR) as EventType[];

export function Terminal() {
  const events = useStore((s) => s.events);
  const [filter, setFilter] = useState<EventType | "ALL">("ALL");
  const [babyOnly, setBabyOnly] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const shown = useMemo(
    () => events.filter((e) => (filter === "ALL" || e.type === filter) && (!babyOnly || e.source === "BABY")),
    [events, filter, babyOnly],
  );

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  return (
    <section id="activity" className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Live Terminal</h2>
        <div className="flex flex-wrap items-center gap-1">
          <select
            aria-label="Filter event type"
            value={filter}
            onChange={(e) => setFilter(e.target.value as EventType | "ALL")}
            className="rounded-sm border border-line bg-panel px-2 py-1 font-mono text-[11px] text-ink"
          >
            <option value="ALL">ALL TYPES</option>
            {ALL.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={() => setBabyOnly((v) => !v)}
            className={`rounded-sm border px-2 py-1 font-mono text-[11px] ${babyOnly ? "border-ice text-ice" : "border-line text-dim"}`}
          >
            BABY ONLY
          </button>
        </div>
      </div>
      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="terminal-scroll panel h-[360px] overflow-y-auto bg-black/60 p-2 font-mono text-[11px] leading-relaxed sm:h-[440px] sm:p-3 sm:text-[12px]"
      >
        {shown.length === 0 && <div className="text-mute">no signal yet<span className="blink">_</span></div>}
        {shown.map((e) => (
          <Line key={e.id} e={e} />
        ))}
      </div>
    </section>
  );
}

function Line({ e }: { e: PublicEvent }) {
  const color = TYPE_COLOR[e.type] ?? "#ccc";
  return (
    <div className="flex gap-2 border-b border-white/[0.03] py-[3px]">
      <span className="hidden shrink-0 text-mute sm:inline">{timeOf(e.ts)}</span>
      <span className="w-[84px] shrink-0 sm:w-[96px]" style={{ color }}>
        [{e.type}]
      </span>
      <SourceBadge source={e.source} />
      <span className={`min-w-0 flex-1 break-words ${e.source === "BABY" ? "text-ink" : "text-dim"}`}>
        {e.message}
        {typeof e.data?.reasoning === "string" && e.data.reasoning && (
          <span className="block text-[11px] text-mute">↳ {e.data.reasoning as string}</span>
        )}
        {e.proofUrl && (
          <a href={e.proofUrl} target="_blank" rel="noreferrer" className="ml-2 text-ice underline decoration-ice/40 underline-offset-2">
            proof ↗
          </a>
        )}
      </span>
    </div>
  );
}
