import type { FastifyInstance } from "fastify";
import { desc, lt } from "drizzle-orm";
import { db } from "../db/client";
import { events } from "../db/schema";
import { getState } from "../services/state";
import type { PublicEvent } from "../../shared/types";

export function toPublicEvent(r: typeof events.$inferSelect): PublicEvent {
  return {
    id: r.id,
    ts: r.ts.toISOString(),
    ageS: r.ageS,
    type: r.type as PublicEvent["type"],
    source: r.source as PublicEvent["source"],
    message: r.message,
    data: (r.data as Record<string, unknown>) ?? null,
    proofUrl: r.proofUrl,
  };
}

export async function recentEvents(limit = 200, before?: number): Promise<PublicEvent[]> {
  const rows = await db
    .select()
    .from(events)
    .where(before ? lt(events.id, before) : undefined)
    .orderBy(desc(events.id))
    .limit(limit);
  return rows.reverse().map(toPublicEvent);
}

export async function publicRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));
  app.get("/state", async (_req, reply) => {
    reply.header("cache-control", "public, max-age=1");
    return getState();
  });
  app.get<{ Querystring: { before?: string; limit?: string } }>("/events", async (req) => {
    const limit = Math.min(500, Number(req.query.limit ?? 200) || 200);
    const before = req.query.before ? Number(req.query.before) : undefined;
    return recentEvents(limit, before);
  });
}
