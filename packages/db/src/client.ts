import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

config({
  path: new URL("../../../.env", import.meta.url),
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

export const db = drizzle(pool);
export type Database = typeof db;