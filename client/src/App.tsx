import { useStore } from "./store";
import { Hero } from "./components/Hero";
import { Terminal } from "./components/Terminal";
import { Chat } from "./components/Chat";
import { ActionLog, Anatomy, DevBars, MemoriesPeople, Proposals, Timeline, Token, Vitals } from "./components/Sections";
import { Admin } from "./components/Admin";

const NAV: [string, string][] = [
  ["BRAIN", "#brain"],
  ["CHAT", "#chat"],
  ["ACTIVITY", "#activity"],
  ["ACTIONS", "#actions"],
  ["MEMORIES", "#memories"],
  ["PEOPLE", "#people"],
  ["TREASURY", "#treasury"],
  ["TOKEN", "#token"],
];

function Nav() {
  const connected = useStore((s) => s.connected);
  const xHandle = useStore((s) => s.state?.token.xHandle);
  const mode = useStore((s) => s.state?.mode);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-void/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4">
        <a href="#brain" className="flex shrink-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-ice shadow-[0_0_8px_#9fd8ff]" : "bg-alarm"}`} />
          <span className="chrome-text font-mono text-[13px] font-semibold tracking-[0.2em]">BABY BRAIN</span>
          {mode === "sim" && <span className="rounded-[2px] border border-amber/50 px-1 font-mono text-[9px] text-amber">SIM</span>}
        </a>
        <nav className="no-scrollbar -mr-4 flex flex-1 items-center gap-4 overflow-x-auto pr-4 font-mono text-[11px] tracking-widest text-dim">
          {NAV.map(([label, href]) => (
            <a key={label} href={href} className="shrink-0 hover:text-ice">
              {label}
            </a>
          ))}
          <a href={xHandle ? `https://x.com/${xHandle}` : "#token"} target={xHandle ? "_blank" : undefined} rel="noreferrer" className="shrink-0 hover:text-ice">
            X
          </a>
        </nav>
      </div>
    </header>
  );
}

export function App() {
  if (location.pathname.startsWith("/admin")) return <Admin />;
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <DevBars />
        <Anatomy />
        <Terminal />
        <Chat />
        <ActionLog />
        <Proposals />
        <Timeline />
        <MemoriesPeople />
        <Vitals />
        <Token />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-6 font-mono text-[10px] leading-relaxed text-mute">
        Every event is labelled by source: BABY (AI-generated), SYSTEM (automation), GUARDIAN (risk engine), HUMAN (operator override).
        Nothing here is financial advice. Baby does not predict prices.
      </footer>
    </>
  );
}
