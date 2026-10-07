import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { Server as IOServer } from "socket.io";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { env, llmProvider } from "./env";
import { db, runMigrations } from "./db/client";
import { timelineFired } from "./db/schema";
import { loadSettings } from "./services/settings";
import { loadCapabilities } from "./services/capabilities";
import { attachIO, emit } from "./services/events";
import { loadFired, startEngine } from "./services/engine";
import { getState, startStateBroadcaster } from "./services/state";
import { publicRoutes, recentEvents } from "./routes/public";
import { adminRoutes } from "./routes/admin";
import { proofRoutes } from "./routes/proof";
import { initAdapters } from "./services/adapters";
import { rebuildSimWorld, simWorld } from "./services/adapters/sim";
import { startMarketPoller } from "./services/market";
import { initSocialState, startMentionPoller } from "./services/social";
import { startAutonomyLoop } from "./services/autonomy";
import { getSettings, setSetting } from "./services/settings";
import { isSim } from "./env";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await runMigrations();
  await loadSettings();
  await loadCapabilities();
  await loadFired();
  await initAdapters();
  if (isSim) {
    await rebuildSimWorld();
    if (!getSettings().tokenMint) {
      await setSetting("tokenMint", simWorld().mint);
      await setSetting("tokenName", "Baby Brain");
      await setSetting("tokenSymbol", "BRAIN");
    }
  }
  await initSocialState();

  // A step whose task was mid-flight when the process died is NOT re-run (it may already have posted / traded).
  const interrupted = await db.update(timelineFired).set({ status: "interrupted" }).where(eq(timelineFired.status, "running")).returning();
  for (const r of interrupted)
    await emit({ type: "WARNING", source: "SYSTEM", message: `restart: step ${r.stepId} was interrupted mid-task and will not be re-run`, data: { stepId: r.stepId } });

  const app = Fastify({ logger: false, trustProxy: true, bodyLimit: 64 * 1024 });
  await app.register(publicRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/admin/api" });
  await app.register(proofRoutes);

  const dist = path.resolve(here, "../dist");
  if (fs.existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (/^\/(api|admin\/api|sim|proof)\//.test(req.url)) return reply.code(404).send({ error: "not found" });
      return reply.sendFile("index.html");
    });
  }

  await app.ready();
  const io = new IOServer(app.server, { cors: { origin: env.NODE_ENV === "production" ? false : "*" }, serveClient: false });
  attachIO(io);
  io.on("connection", async (socket) => {
    socket.emit("state", await getState());
    socket.emit("events", await recentEvents(200));
  });

  startStateBroadcaster();
  startEngine();
  startMarketPoller();
  startMentionPoller();
  startAutonomyLoop();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`Baby Brain up on :${env.PORT}  MODE=${env.MODE}  SIM_SPEED=${env.SIM_SPEED}  LLM=${llmProvider}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
