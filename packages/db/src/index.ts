// Database entrypoint for `@wandit/db`.
//
// Drizzle wraps a Postgres pool and gives typed query helpers. API and worker
// both use this package to talk to the same database.
import { env } from "@wandit/env/server";

// Re-export common Drizzle SQL helpers for repositories.
export {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNull,
	lt,
	lte,
	ne,
	notInArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
// Public dialect for compiling bare SQL fragments in repository tests —
// consumers don't depend on drizzle-orm directly, so it must ride through here.
export { PgDialect } from "drizzle-orm/pg-core";

import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool, type PoolConfig } from "pg";

import * as schema from "./schema";

export type DbPoolOptions = Pick<PoolConfig, "idleTimeoutMillis" | "max">;

// For session-scoped locks that must not pin a pooled connection.
export function createDedicatedClient(): Client {
	return new Client({ connectionString: env.DATABASE_URL });
}

// Create a typed database client around a node-postgres pool.
export function createDb(options: DbPoolOptions = {}) {
	// Each call creates a new pool. Do not call this repeatedly in hot paths.
	const pool = new Pool({ connectionString: env.DATABASE_URL, ...options });

	// Idle clients can fail asynchronously; logging the pool event prevents an
	// unhandled EventEmitter error from crashing API, worker, or task processes.
	pool.on("error", (error) => {
		console.error("PostgreSQL pool error", error);
	});

	// Drizzle uses the schema so queries know table/column names.
	return drizzle(pool, { schema });
}

// Convenience singleton for code that does not ask Nest to pass the DB in.
export const db = createDb();
