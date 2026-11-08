import { useEffect, useState } from "react";
import { useStore } from "../store";

const KEY = "bb.admin";
const read = () => {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export function Admin() {
  const [token, setToken] = useState(read);
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const state = useStore((s) => s.state);
  const [launchAt, setLaunchAt] = useState("");
  const [mint, setMint] = useState("");
  const [skip, setSkip] = useState("");
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [walletMsg, setWalletMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, body?: unknown) {
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      /* ignore */
    }
    const res = await fetch(`/admin/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setLog((l) => [`${res.status} ${path} ${JSON.stringify(json).slice(0, 200)}`, ...l].slice(0, 30));
    return json;
  }

  async function loadWallet() {
    if (!token) return;
    const r = await fetch("/admin/api/wallet", { headers: { authorization: `Bearer ${token}` } });
    if (r.ok) setWallet(await r.json());
  }

  useEffect(() => {
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // The private key goes straight to the server and is cleared from the form; it is never put in the request log below.
  async function importWallet() {
    if (!secretKey.trim() || busy) return;
    setBusy(true);
    setWalletMsg(null);
    try {
      const res = await fetch("/admin/api/wallet/import", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ secretKey: secretKey.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      setLog((l) => [`${res.status} /wallet/import ${res.ok ? json.pubkey : json.error ?? ""}`, ...l].slice(0, 30));
      if (res.ok) {
        setSecretKey("");
        setWallet(json);
        setWalletMsg({ ok: true, text: `Imported ${json.pubkey}` });
      } else setWalletMsg({ ok: false, text: json.error ?? `HTTP ${res.status}` });
    } finally {
      setBusy(false);
    }
  }

  async function removeWallet() {
    if (!wallet || wallet.source !== "imported") return;
    if (!confirm(`Remove imported treasury wallet ${wallet.pubkey}? The funds stay in that wallet; Baby falls back to ${wallet.envPubkey ?? "no treasury"}.`)) return;
    const json = await call("/wallet/remove", {});
    if (json.ok) {
      setWallet(json);
      setWalletMsg({ ok: true, text: "Imported wallet removed" });
    }
  }

  useEffect(() => {
    if (!token) return;
    const id = setInterval(async () => {
      const r = await fetch("/admin/api/status", { headers: { authorization: `Bearer ${token}` } });
      if (r.ok) setStatus(await r.json());
    }, 3000);
    return () => clearInterval(id);
  }, [token]);

  const f = state?.flags;
  const toggle = (k: string, v: boolean) => call("/flags", { [k]: v });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 font-mono text-[12px]">
      <h1 className="section-title mb-4">Operator Console</h1>
      <p className="mb-4 text-dim">Every action here is logged publicly as a HUMAN event.</p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ADMIN_TOKEN"
        className="mb-6 w-full rounded-sm border border-line bg-black px-2 py-2 text-ink"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Kill switches">
          <Btn danger={!f?.xPaused} onClick={() => toggle("xPaused", !f?.xPaused)}>{f?.xPaused ? "RESUME X POSTING" : "PAUSE X POSTING"}</Btn>
          <Btn danger={!f?.chatPaused} onClick={() => toggle("chatPaused", !f?.chatPaused)}>{f?.chatPaused ? "RESUME CHAT" : "PAUSE CHAT"}</Btn>
          <Btn danger={!f?.treasuryFrozen} onClick={() => toggle("treasuryFrozen", !f?.treasuryFrozen)}>{f?.treasuryFrozen ? "UNFREEZE TREASURY" : "FREEZE TREASURY"}</Btn>
          <Btn danger={!!f?.autonomyEnabled} onClick={() => toggle("autonomyEnabled", !f?.autonomyEnabled)}>{f?.autonomyEnabled ? "DISABLE AUTONOMOUS LOOP" : "ENABLE AUTONOMOUS LOOP"}</Btn>
        </Card>

        <Card title="Launch">
          <input value={launchAt} onChange={(e) => setLaunchAt(e.target.value)} placeholder="ISO UTC e.g. 2026-10-10T18:00:00Z" className="w-full rounded-sm border border-line bg-black px-2 py-1.5 text-ink" />
          <Btn onClick={() => call("/launch", { launchAt: launchAt || "now" })}>{launchAt ? "SET LAUNCH_TIMESTAMP" : "LAUNCH NOW"}</Btn>
          <input value={mint} onChange={(e) => setMint(e.target.value)} placeholder="TOKEN_MINT" className="w-full rounded-sm border border-line bg-black px-2 py-1.5 text-ink" />
          <Btn onClick={() => call("/launch", { tokenMint: mint })}>SET TOKEN_MINT</Btn>
        </Card>

        <Card title="Timeline">
          <select value={skip} onChange={(e) => setSkip(e.target.value)} className="w-full rounded-sm border border-line bg-black px-2 py-1.5 text-ink">
            <option value="">— step —</option>
            {state?.timeline.filter((s) => s.wired && !s.fired).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <Btn danger onClick={() => skip && call("/skip-step", { stepId: skip })}>FORCE-SKIP STEP</Btn>
        </Card>

        <Card title="Treasury wallet">
          <div className="text-[11px] leading-relaxed text-dim">
            {wallet ? (
              <>
                <div className="break-all text-ink">{wallet.pubkey ?? "— none —"}</div>
                <div>
                  {wallet.source === "imported"
                    ? `imported ${new Date(wallet.importedAt!).toLocaleString()} · encrypted in DB`
                    : wallet.source === "env"
                      ? "from TREASURY_PUBKEY / TREASURY_PRIVATE_KEY"
                      : "not configured"}
                </div>
              </>
            ) : (
              "enter ADMIN_TOKEN to load"
            )}
          </div>
          {wallet && !wallet.encryptionConfigured ? (
            <p className="text-[11px] text-amber">Set the WALLET_ENCRYPTION_KEY secret (at least 32 chars, e.g. openssl rand -hex 32) and restart to enable importing.</p>
          ) : (
            <>
              <textarea
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Private key — base58 (Phantom → Export Private Key) or solana-keygen JSON array"
                rows={2}
                autoComplete="off"
                spellCheck={false}
                className="w-full resize-none rounded-sm border border-line bg-black px-2 py-1.5 text-ink [-webkit-text-security:disc]"
              />
              <Btn danger onClick={importWallet}>{busy ? "IMPORTING…" : "IMPORT AS TREASURY"}</Btn>
            </>
          )}
          {wallet?.source === "imported" && (
            <Btn onClick={removeWallet}>REMOVE IMPORTED WALLET</Btn>
          )}
          {walletMsg && <p className={`break-all text-[11px] ${walletMsg.ok ? "text-ice" : "text-alarm"}`}>{walletMsg.text}</p>}
          {state?.mode === "sim" && <p className="text-[11px] text-mute">Simulation mode: the key is stored, but trades stay simulated until MODE=live.</p>}
        </Card>

        {state?.mode === "sim" && (
          <Card title="Simulation">
            <Btn onClick={() => call("/sim/run-first-hour", {})}>RUN FULL FIRST HOUR (×{state.simSpeed})</Btn>
            <Btn danger onClick={() => call("/sim/reset", {})}>RESET TO GESTATING</Btn>
          </Card>
        )}
      </div>

      {status && (
        <pre className="panel mt-6 max-h-64 overflow-auto p-3 text-[11px] text-dim">{JSON.stringify({ ageS: status.ageS, queue: status.queue }, null, 2)}</pre>
      )}
      <div className="panel mt-6 max-h-64 overflow-auto p-3 text-[11px] text-dim">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="panel flex flex-col gap-2 p-3">
    <div className="hud-label">{title}</div>
    {children}
  </div>
);

const Btn = ({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) => (
  <button onClick={onClick} className={`rounded-sm border px-3 py-1.5 text-left text-[11px] ${danger ? "border-alarm/60 text-alarm" : "border-ice/60 text-ice"}`}>
    {children}
  </button>
);

interface WalletStatus {
  pubkey: string | null;
  source: "imported" | "env" | null;
  importedAt: string | null;
  envPubkey: string | null;
  encryptionConfigured: boolean;
}
