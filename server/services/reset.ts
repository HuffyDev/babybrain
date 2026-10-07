import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { loadCapabilities } from "./capabilities";
import { loadFired } from "./engine";
import { queue } from "./queue";
import { resetHooks } from "./resetHooks";

const TABLES = [
  "capabilities",
  "timeline_fired",
  "events",
  "proposals",
  "actions",
  "memories",
  "people",
  "interactions",
  "mentions",
  "slang",
  "market_snapshots",
  "trades",
  "x_spend",
  "chat_messages",
];

/** Sim only: wipe all run state (settings/kill switches are kept). */
export async function resetSim() {
  queue.reset();
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY`));
  await loadCapabilities();
  await loadFired();
  for (const h of resetHooks) await h();
}
