import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env";
import * as schema from "./schema";

const ssl =
  /sslmode=require/.test(env.DATABASE_URL) || /neon\.tech/.test(env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : undefined;

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10, ssl });
export const db = drizzle(pool, { schema });
export type DB = typeof db;

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.resolve(here, "../../drizzle") });
}
