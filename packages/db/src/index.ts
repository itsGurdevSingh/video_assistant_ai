import { Client } from "pg";
import { config } from "dotenv";

config({
  path: new URL("../../../.env", import.meta.url),
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

const client = new Client({
  connectionString: databaseUrl,
});

async function main() {
  await client.connect();

  const result = await client.query("SELECT 1 AS result");

  console.log(result.rows);

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});