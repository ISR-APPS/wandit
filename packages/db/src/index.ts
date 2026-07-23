// Database entrypoint for `@wandit/db`.
//
// Drizzle wraps a Postgres pool and gives typed query helpers. API and worker
// both use this package to talk to the same database.
import { env } from "@wandit/env/server";

// Re-export common Drizzle SQL helpers for repositories.
export { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// Create a typed database client around a node-postgres pool.
export function createDb() {
	// Each call creates a new pool. Do not call this repeatedly in hot paths.
	const pool = new Pool({ connectionString: env.DATABASE_URL });
	// Drizzle uses the schema so queries know table/column names.
	return drizzle(pool, { schema });
}

// Convenience singleton for code that does not ask Nest to pass the DB in.
export const db = createDb();
