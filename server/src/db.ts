import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

function withPgSslCompat(url: string): string {
  const u = new URL(url);
  // Silence pg v8→v9 sslmode warning while keeping Neon’s sslmode=require.
  if (!u.searchParams.has("uselibpqcompat")) {
    u.searchParams.set("uselibpqcompat", "true");
  }
  if (!u.searchParams.has("sslmode")) {
    u.searchParams.set("sslmode", "require");
  }
  return u.toString();
}

const appUrl = process.env.DATABASE_URL;
const migrateUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!appUrl) {
  throw new Error(
    "DATABASE_URL is missing. Run `pnpm exec neon env pull` after linking a Neon project.",
  );
}

const pool = new pg.Pool({
  connectionString: withPgSslCompat(appUrl),
  // Serverless / Next.js route handlers: keep the pool tiny.
  max: 1,
});

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function migrate(): Promise<void> {
  if (!migrateUrl) {
    throw new Error("DATABASE_URL_UNPOOLED (or DATABASE_URL) is required for migrations.");
  }

  // Migrations use the direct (non-pooled) connection.
  const client = new pg.Client({
    connectionString: withPgSslCompat(migrateUrl),
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS __migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRes = await client.query<{ id: string }>("SELECT id FROM __migrations");
    const applied = new Set(appliedRes.rows.map((r) => r.id));

    const migrationsDir = path.join(root, "drizzle");
    const journalPath = path.join(migrationsDir, "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: { tag: string }[];
    };

    for (const entry of journal.entries) {
      if (applied.has(entry.tag)) continue;
      const file = path.join(migrationsDir, `${entry.tag}.sql`);
      const sql = fs.readFileSync(file, "utf8");
      const statements = splitStatements(sql);

      await client.query("BEGIN");
      try {
        for (const stmt of statements) {
          await client.query(stmt);
        }
        await client.query("INSERT INTO __migrations (id, applied_at) VALUES ($1, NOW())", [
          entry.tag,
        ]);
        await client.query("COMMIT");
        console.log(`[db] applied migration ${entry.tag}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}
