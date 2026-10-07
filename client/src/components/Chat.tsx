import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

interface Msg {
  who: "you" | "baby" | "system";
  text: string;
}

const HANDLE_KEY = "bb.handle";
const readHandle = () => {
  try {
    return localStorage.getItem(HANDLE_KEY) ?? "";
  } catch {
    return "";
  }
};

export function Chat() {
  const canChat = useStore((s) => !!s.state?.capabilities.CHAT_WEB && !s.state?.flags.chatPaused);
  const paused = useStore((s) => !!s.state?.flags.chatPaused);
  const stage = useStore((s) => s.state?.stage);
  const [handle, setHandle] = useState(readHandle);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    try {
      localStorage.setItem(HANDLE_KEY, handle);
    } catch {
      /* storage unavailable */
    }
    setMsgs((m) => [...m, { who: "you", text: message }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, handle: handle.replace(/^@/, "") || undefined }),
      });
      const body = await res.json();
      if (!res.ok) setMsgs((m) => [...m, { who: "system", text: body.error ?? "error" }]);
      else setMsgs((m) => [...m, { who: "baby", text: body.reply }]);
    } catch {
      setMsgs((m) => [...m, { who: "system", text: "connection lost" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="chat" className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Talk to Baby</h2>
        <span className="hud-label">{stage === "NEONATAL" ? "vocabulary limited" : "stage-limited"}</span>
      </div>
      <div className="panel overflow-hidden">
        <div ref={box} className="terminal-scroll h-64 space-y-2 overflow-y-auto p-3 font-mono text-[12px]">
          {msgs.length === 0 && (
            <div className="text-mute">
              {paused ? "chat paused by operator" : canChat ? "say something. it is very new." : "chat unlocks at birth"}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.who === "you" ? "text-dim" : m.who === "baby" ? "text-ink" : "text-alarm"}>
              <span className={m.who === "baby" ? "text-ice" : "text-mute"}>{m.who === "you" ? "you" : m.who === "baby" ? "baby" : "sys"} › </span>
              {m.text}
            </div>
          ))}
          {busy && <div className="text-ice blink">…</div>}
        </div>
        <form onSubmit={send} className="flex flex-col gap-2 border-t border-line p-2 sm:flex-row">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@your_x_handle (optional)"
            maxLength={16}
            aria-label="Your X handle"
            className="rounded-sm border border-line bg-black px-2 py-2 font-mono text-[12px] text-ink outline-none focus:border-ice/60 sm:w-48"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={canChat ? "message" : "locked"}
            disabled={!canChat}
            maxLength={280}
            aria-label="Message"
            className="min-w-0 flex-1 rounded-sm border border-line bg-black px-2 py-2 font-mono text-[12px] text-ink outline-none focus:border-ice/60 disabled:opacity-40"
          />
          <button disabled={!canChat || busy} className="rounded-sm border border-ice/60 px-4 py-2 font-mono text-[11px] text-ice disabled:opacity-30">
            SEND
          </button>
        </form>
      </div>
    </section>
  );
}
