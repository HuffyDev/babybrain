import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env, isSim } from "../env";
import { emit, markDirty } from "../services/events";
import { getSettings, setSetting } from "../services/settings";
import { adminStatus, skipStep } from "../services/engine";
import { resetSim } from "../services/reset";
import { importTreasuryKey, removeImportedTreasuryKey, treasuryWalletStatus } from "../services/treasuryWallet";

function authorized(req: FastifyRequest): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const h = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? (req.headers["x-admin-token"] as string | undefined);
  if (!h) return false;
  const a = Buffer.from(h);
  const b = Buffer.from(env.ADMIN_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function human(what: string, data?: Record<string, unknown>) {
  await emit({ type: "WARNING", source: "HUMAN", message: `HUMAN SAFETY OVERRIDE ACTIVATED — ${what}`, data });
}

const flagsBody = z.object({
  xPaused: z.boolean().optional(),
  chatPaused: z.boolean().optional(),
  treasuryFrozen: z.boolean().optional(),
  autonomyEnabled: z.boolean().optional(),
});

type Flag = "xPaused" | "chatPaused" | "treasuryFrozen" | "autonomyEnabled";
const flagText: Record<Flag, [string, string]> = {
  xPaused: ["X posting paused", "X posting resumed"],
  chatPaused: ["web chat paused", "web chat resumed"],
  treasuryFrozen: ["treasury frozen", "treasury unfrozen"],
  autonomyEnabled: ["autonomous loop enabled", "autonomous loop disabled"],
};

const launchBody = z.object({
  launchAt: z.union([z.literal("now"), z.string().datetime({ offset: true }), z.null()]).optional(),
  tokenMint: z.string().min(32).max(64).nullable().optional(),
  tokenName: z.string().max(64).nullable().optional(),
  tokenSymbol: z.string().max(16).nullable().optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!env.ADMIN_TOKEN) return reply.code(503).send({ error: "ADMIN_TOKEN not configured" });
    if (!authorized(req)) return reply.code(401).send({ error: "unauthorized" });
  });

  app.get("/status", async () => ({ mode: env.MODE, settings: getSettings(), ...(await adminStatus()) }));

  app.post("/flags", async (req, reply) => {
    const body = flagsBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.message });
    for (const [k, v] of Object.entries(body.data) as [Flag, boolean | undefined][]) {
      if (v === undefined || getSettings()[k] === v) continue;
      await setSetting(k, v);
      await human(flagText[k][v ? 0 : 1], { flag: k, value: v });
    }
    markDirty();
    return { ok: true, settings: getSettings() };
  });

  app.post("/launch", async (req, reply) => {
    const body = launchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.message });
    const d = body.data;
    if (d.launchAt !== undefined) {
      const iso = d.launchAt === "now" ? new Date().toISOString() : d.launchAt ? new Date(d.launchAt).toISOString() : null;
      await setSetting("launchAt", iso);
      await human(`LAUNCH_TIMESTAMP set to ${iso ?? "unset"}`, { launchAt: iso });
    }
    for (const k of ["tokenMint", "tokenName", "tokenSymbol"] as const) {
      if (d[k] !== undefined) {
        await setSetting(k, d[k] ?? null);
        await human(`${k} set to ${d[k] ?? "unset"}`, { [k]: d[k] });
      }
    }
    markDirty();
    return { ok: true, settings: getSettings() };
  });

  app.get("/wallet", async () => treasuryWalletStatus());

  // The body carries a private key: it is never echoed, logged or put in an event. Only the pubkey is published.
  app.post("/wallet/import", async (req, reply) => {
    const body = z.object({ secretKey: z.string().min(1).max(1024) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "paste a private key (base58 or JSON byte array)" });
    try {
      const r = await importTreasuryKey(body.data.secretKey);
      await human(`treasury wallet imported: ${r.pubkey}${r.previous && r.previous !== r.pubkey ? ` (replaces ${r.previous})` : ""}`, { pubkey: r.pubkey, previous: r.previous });
      markDirty();
      return { ok: true, ...treasuryWalletStatus() };
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "import failed" });
    }
  });

  app.post("/wallet/remove", async (_req, reply) => {
    const r = await removeImportedTreasuryKey();
    if (!r.removed) return reply.code(400).send({ error: "no imported treasury wallet" });
    await human(`imported treasury wallet ${r.removed} removed; treasury now ${r.now ?? "unset"}`, { removed: r.removed, now: r.now });
    markDirty();
    return { ok: true, ...treasuryWalletStatus() };
  });

  app.post("/skip-step", async (req, reply) => {
    const body = z.object({ stepId: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.message });
    const res = await skipStep(body.data.stepId);
    if (!res.ok) return reply.code(400).send(res);
    await human(`step ${body.data.stepId} force-skipped`, { stepId: body.data.stepId });
    return res;
  });

  app.post("/sim/run-first-hour", async (_req, reply) => {
    if (!isSim) return reply.code(400).send({ error: "only available in MODE=sim" });
    await resetSim();
    const iso = new Date().toISOString();
    await setSetting("launchAt", iso);
    await human(`sim reset; full first hour started (×${env.SIM_SPEED})`, { launchAt: iso });
    markDirty();
    return { ok: true, launchAt: iso };
  });

  app.post("/sim/reset", async (_req, reply) => {
    if (!isSim) return reply.code(400).send({ error: "only available in MODE=sim" });
    await resetSim();
    await setSetting("launchAt", null);
    await human("sim reset to GESTATING");
    markDirty();
    return { ok: true };
  });
}
