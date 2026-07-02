import { env } from "@my-better-t-app/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// TCP driver, not neon-http: the API/worker are long-running processes, and
// credits consume / publish lifecycle / version numbering need interactive
// transactions the HTTP driver can't run.
export function createDb() {
	const pool = new Pool({ connectionString: env.DATABASE_URL });
	return drizzle(pool, { schema });
}

export const db = createDb();
