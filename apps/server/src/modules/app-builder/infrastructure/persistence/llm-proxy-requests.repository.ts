/**
 * Writes and reads `llm_proxy_requests` rows for the V2 LLM proxy.
 * `LlmProxyService` calls `insert` once per request.
 * The builder-turn runtime and the reconcile sweep call `sumByTurn` to
 * settle a turn's spend; the runtime's timing line calls
 * `firstRequestStartedAtMs`, and its end calls `capRejectionReason`.
 * `AppProjectsService` calls `sumByChat` for the cost of one chat.
 * `sumUsdMicrosByRun` has no production caller yet.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { ChatCostResponse } from "@wandit/contracts";
import { sql } from "@wandit/db";
import { builderTurns } from "@wandit/db/schema/builder-turns";
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

/** Spend and token sums of one turn for one model, in whole tokens/micros. */
export type LlmProxyModelSum = {
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	usdMicros: number;
};

/** Spend and token sums of one turn across all models, with the per-model rows. */
export type LlmProxyTurnSum = {
	usdMicros: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	byModel: LlmProxyModelSum[];
};

// Raw Postgres row for the `sumByTurn` query; bigint columns come back as
// strings under node-postgres.
type LlmProxyModelSumDbRow = {
	model: string | null;
	usd_micros: number | string;
	input_tokens: number | string;
	output_tokens: number | string;
	cache_read_tokens: number | string;
	cache_write_tokens: number | string;
};

// Raw Postgres row for the per-model query of `sumByChat`; bigint columns
// come back as strings under node-postgres. `model` is never null: the
// query drops rows with a null model.
type LlmProxyChatModelDbRow = LlmProxyModelSumDbRow & {
	model: string;
	request_count: number | string;
};

// Raw Postgres row for the turn query of `sumByChat`.
type ChatTurnsDbRow = {
	turn_count: number | string;
	credits: number | string;
};

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

	/**
	 * When the turn's first proxy request left the sandbox, as epoch ms:
	 * the earliest `createdAt` minus its `latencyMs`, over every status.
	 * Null when the turn has no row. Only the `builder-turn.timing` log
	 * line reads it; money never does.
	 */
	async firstRequestStartedAtMs(turnId: string): Promise<number | null> {
		const result = await this.db.execute<{
			started_at_ms: number | string | null;
		}>(sql`
			select (extract(epoch from min(
				${llmProxyRequests.createdAt}
				- coalesce(${llmProxyRequests.latencyMs}, 0) * interval '1 millisecond'
			)) * 1000)::bigint as started_at_ms
			from ${llmProxyRequests}
			where ${llmProxyRequests.turnId} = ${turnId}
		`);
		const value = result.rows[0]?.started_at_ms ?? null;
		// bigint comes back as a string under node-postgres.
		return value === null ? null : Number(value);
	}

	/**
	 * The cap of the first spend-cap refusal of the turn: `run_cap` (402
	 * V2_RUN_CAP_REACHED) or `daily_cap` (402 V2_DAILY_CAP_REACHED). Null
	 * when the proxy refused no request of the turn on a cap. The runtime
	 * reads it at the stream end to stop the turn on that cap.
	 */
	async capRejectionReason(
		turnId: string,
	): Promise<"run_cap" | "daily_cap" | null> {
		const result = await this.db.execute<{ reason: string | null }>(sql`
			select ${llmProxyRequests.reason} as reason
			from ${llmProxyRequests}
			where
				${llmProxyRequests.turnId} = ${turnId}
				and ${llmProxyRequests.status} = 'cap_rejected'
				and ${llmProxyRequests.reason} in ('run_cap', 'daily_cap')
			order by ${llmProxyRequests.createdAt}
			limit 1
		`);
		const reason = result.rows[0]?.reason;
		return reason === "run_cap" || reason === "daily_cap" ? reason : null;
	}

	/**
	 * Spend and token sums of one turn, grouped by model. Only `ok` and
	 * `client_aborted` rows count: a client_aborted row carries the usage
	 * the upstream streamed or buffered before the abort; rejected and
	 * failed rows carry none. All zeros when the turn has no rows.
	 */
	async sumByTurn(turnId: string): Promise<LlmProxyTurnSum> {
		const result = await this.db.execute<LlmProxyModelSumDbRow>(sql`
			select
				${llmProxyRequests.model} as model,
				coalesce(sum(${llmProxyRequests.usdMicros}), 0)::bigint as usd_micros,
				coalesce(sum(${llmProxyRequests.inputTokens}), 0)::bigint as input_tokens,
				coalesce(sum(${llmProxyRequests.outputTokens}), 0)::bigint as output_tokens,
				coalesce(sum(${llmProxyRequests.cacheReadTokens}), 0)::bigint as cache_read_tokens,
				coalesce(sum(${llmProxyRequests.cacheWriteTokens}), 0)::bigint as cache_write_tokens
			from ${llmProxyRequests}
			where
				${llmProxyRequests.turnId} = ${turnId}
				and ${llmProxyRequests.status} in ('ok', 'client_aborted')
			group by ${llmProxyRequests.model}
			order by ${llmProxyRequests.model}
		`);

		const sum: LlmProxyTurnSum = {
			usdMicros: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			byModel: [],
		};
		for (const row of result.rows) {
			// `model` is nullable (rejected rows store null); a counted row
			// always carries one, so a null group cannot carry billable usage.
			if (row.model === null) {
				continue;
			}
			const modelSum: LlmProxyModelSum = {
				model: row.model,
				inputTokens: Number(row.input_tokens),
				outputTokens: Number(row.output_tokens),
				cacheReadTokens: Number(row.cache_read_tokens),
				cacheWriteTokens: Number(row.cache_write_tokens),
				usdMicros: Number(row.usd_micros),
			};
			sum.byModel.push(modelSum);
			sum.usdMicros += modelSum.usdMicros;
			sum.inputTokens += modelSum.inputTokens;
			sum.outputTokens += modelSum.outputTokens;
			sum.cacheReadTokens += modelSum.cacheReadTokens;
			sum.cacheWriteTokens += modelSum.cacheWriteTokens;
		}
		return sum;
	}

	/**
	 * The full cost of one chat: the proxy rows of its turns, summed per
	 * model, plus the settled credits and the turn count. Only turns of
	 * `projectId` count. All zeros when the chat has no turns.
	 */
	async sumByChat(
		projectId: string,
		chatId: string,
	): Promise<ChatCostResponse> {
		// Every status counts, so a failed stream adds the usage it streamed.
		// The settle counts only `ok` and `client_aborted` rows. A null model
		// marks a refused request with no tokens and no price: no entry.
		const modelRows = await this.db.execute<LlmProxyChatModelDbRow>(sql`
			select
				${llmProxyRequests.model} as model,
				coalesce(sum(${llmProxyRequests.usdMicros}), 0)::bigint as usd_micros,
				coalesce(sum(${llmProxyRequests.inputTokens}), 0)::bigint as input_tokens,
				coalesce(sum(${llmProxyRequests.outputTokens}), 0)::bigint as output_tokens,
				coalesce(sum(${llmProxyRequests.cacheReadTokens}), 0)::bigint as cache_read_tokens,
				coalesce(sum(${llmProxyRequests.cacheWriteTokens}), 0)::bigint as cache_write_tokens,
				count(*)::bigint as request_count
			from ${llmProxyRequests}
			inner join ${builderTurns}
				on ${builderTurns.id} = ${llmProxyRequests.turnId}
			where
				${builderTurns.chatId} = ${chatId}
				and ${builderTurns.projectId} = ${projectId}
				and ${llmProxyRequests.model} is not null
			group by ${llmProxyRequests.model}
			order by ${llmProxyRequests.model}
		`);
		// A separate query: the join above repeats a turn once per proxy
		// row, so a sum of `credits` over it would count a turn many times.
		const turnRows = await this.db.execute<ChatTurnsDbRow>(sql`
			select
				count(*)::bigint as turn_count,
				coalesce(sum(${builderTurns.credits}), 0)::bigint as credits
			from ${builderTurns}
			where
				${builderTurns.chatId} = ${chatId}
				and ${builderTurns.projectId} = ${projectId}
		`);

		// bigint comes back as a string under node-postgres. A chat stays far
		// below 2^53 micros or tokens, so Number() is exact.
		const cost: ChatCostResponse = {
			usdMicros: 0,
			credits: Number(turnRows.rows[0]?.credits ?? 0),
			turnCount: Number(turnRows.rows[0]?.turn_count ?? 0),
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			byModel: [],
		};
		for (const row of modelRows.rows) {
			const usdMicros = Number(row.usd_micros);
			cost.byModel.push({
				model: row.model,
				usdMicros,
				requestCount: Number(row.request_count),
			});
			cost.usdMicros += usdMicros;
			cost.inputTokens += Number(row.input_tokens);
			cost.outputTokens += Number(row.output_tokens);
			cost.cacheReadTokens += Number(row.cache_read_tokens);
			cost.cacheWriteTokens += Number(row.cache_write_tokens);
		}
		return cost;
	}
}
