/**
 * Writes and reads `llm_proxy_requests` rows for the V2 LLM proxy.
 * `LlmProxyService` calls `insert` once per request; WANDIT-174 calls
 * `sumUsdMicrosByRun` to reconcile a run's spend against its cap.
 */
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "@wandit/db";
import { llmProxyRequests } from "@wandit/db/schema/llm-proxy-requests";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** Row shape the service inserts; `id` and `createdAt` default in Postgres. */
export type NewLlmProxyRequest = Omit<
	typeof llmProxyRequests.$inferInsert,
	"id" | "createdAt"
>;

/**
 * The service only needs `insert`; the type is structural so a spec can
 * pass a plain object without a cast.
 */
export type LlmProxyRequestWriter = Pick<LlmProxyRequestsRepository, "insert">;

/** Drizzle repository for the `llm_proxy_requests` table. */
@Injectable()
export class LlmProxyRequestsRepository {
	// The Pick keeps the constructor param structural: specs pass a literal.
	constructor(
		@Inject(DATABASE)
		private readonly db: Pick<Database, "insert" | "execute">,
	) {}

	async insert(row: NewLlmProxyRequest): Promise<{ id: string }> {
		const [inserted] = await this.db
			.insert(llmProxyRequests)
			.values(row)
			.returning({ id: llmProxyRequests.id });
		if (inserted === undefined) {
			throw new Error("llm_proxy_requests insert returned no row");
		}
		return { id: inserted.id };
	}

	/** Total spend of one run in USD micros; 0 when the run has no rows. */
	async sumUsdMicrosByRun(runId: string): Promise<number> {
		const result = await this.db.execute<{ usd_micros: number | string }>(
			sql`select coalesce(sum(${llmProxyRequests.usdMicros}), 0)::bigint as usd_micros from ${llmProxyRequests} where ${llmProxyRequests.runId} = ${runId}`,
		);
		const row = result.rows[0];
		// bigint comes back as a string under node-postgres.
		return Number(row?.usd_micros ?? 0);
	}
}
