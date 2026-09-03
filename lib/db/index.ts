import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// A single shared connection pool for server-side (Node runtime) usage only.
// Never import this file from a Client Component.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
