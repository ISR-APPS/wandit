import { PgDialect } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import {
	LlmProxyRequestsRepository,
	type NewLlmProxyRequest,
} from "./llm-proxy-requests.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SqlQuery) {
	const rendered = new PgDialect().sqlToQuery(query);
	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setup() {
	// Bare vi.fn()s keep the `any` signature so the stubs satisfy drizzle's
	// generic `insert`/`execute` types without a cast.
	const insert = vi.fn();
	const execute = vi.fn();
	const repository = new LlmProxyRequestsRepository({ insert, execute });
	return { execute, insert, repository };
}

const row: NewLlmProxyRequest = {
	runId: "run_1",
	turnId: "11111111-2222-4333-8444-555555555555",
	userId: "user_1",
	projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
	organizationId: null,
	provider: "anthropic",
	model: "claude-sonnet-5",
	inboundFormat: "anthropic",
	inputTokens: 120,
	outputTokens: 17,
	cacheReadTokens: 30,
	cacheWriteTokens: 40,
	usdMicros: 550,
	status: "ok",
	reason: null,
	upstreamRequestId: "req_1",
	claudeSessionId: "sess_1",
	latencyMs: 812,
};

describe("LlmProxyRequestsRepository", () => {
	it("inserts one row and returns its id", async () => {
		const { insert, repository } = setup();
		const returning = vi.fn(async () => [{ id: "row-1" }]);
		const values = vi.fn(() => ({ returning }));
		insert.mockReturnValue({ values });

		await expect(repository.insert(row)).resolves.toEqual({ id: "row-1" });
		expect(insert).toHaveBeenCalledOnce();
		expect(values).toHaveBeenCalledWith(row);
	});

	it("throws when the insert returns no row", async () => {
		const { insert, repository } = setup();
		const returning = vi.fn(async () => [] as { id: string }[]);
		const values = vi.fn(() => ({ returning }));
		insert.mockReturnValue({ values });

		await expect(repository.insert(row)).rejects.toThrow(
			"llm_proxy_requests insert returned no row",
		);
	});

	it("sums usdMicros for one run", async () => {
		const { execute, repository } = setup();
		execute.mockResolvedValue({ rows: [{ usd_micros: "1250" }] });

		const total = await repository.sumUsdMicrosByRun("run_1");
		expect(total).toBe(1250);

		const compiled = compile(execute.mock.calls[0]?.[0]);
		expect(compiled.sql).toContain('from "llm_proxy_requests"');
		expect(compiled.sql).toContain("run_id");
		expect(compiled.params).toContain("run_1");
	});

	it("reads 0 when the run has no rows", async () => {
		const { execute, repository } = setup();
		execute.mockResolvedValue({ rows: [{ usd_micros: "0" }] });

		expect(await repository.sumUsdMicrosByRun("run_none")).toBe(0);
	});

	it("sums usage and spend per model for one turn", async () => {
		const { execute, repository } = setup();
		execute.mockResolvedValue({
			rows: [
				{
					model: "anthropic/claude-sonnet-5",
					usd_micros: "1500",
					input_tokens: "60000",
					output_tokens: "12000",
					cache_read_tokens: "180000",
					cache_write_tokens: "20000",
				},
				{
					model: "anthropic/claude-haiku-4-5",
					usd_micros: "250",
					input_tokens: "5000",
					output_tokens: "1000",
					cache_read_tokens: "0",
					cache_write_tokens: "0",
				},
			],
		});

		const sum = await repository.sumByTurn("turn_1");

		expect(sum).toEqual({
			usdMicros: 1750,
			inputTokens: 65_000,
			outputTokens: 13_000,
			cacheReadTokens: 180_000,
			cacheWriteTokens: 20_000,
			byModel: [
				{
					model: "anthropic/claude-sonnet-5",
					usdMicros: 1500,
					inputTokens: 60_000,
					outputTokens: 12_000,
					cacheReadTokens: 180_000,
					cacheWriteTokens: 20_000,
				},
				{
					model: "anthropic/claude-haiku-4-5",
					usdMicros: 250,
					inputTokens: 5000,
					outputTokens: 1000,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
				},
			],
		});

		const compiled = compile(execute.mock.calls[0]?.[0]);
		expect(compiled.sql).toContain('"llm_proxy_requests"."turn_id" = $1');
		expect(compiled.sql).toContain('"llm_proxy_requests"."status" = \'ok\'');
		expect(compiled.sql).toContain("group by");
		expect(compiled.params).toEqual(["turn_1"]);
	});

	it("skips a null-model group in the turn sum", async () => {
		const { execute, repository } = setup();
		execute.mockResolvedValue({
			rows: [
				{
					model: null,
					usd_micros: "500",
					input_tokens: "10",
					output_tokens: "10",
					cache_read_tokens: "0",
					cache_write_tokens: "0",
				},
			],
		});

		expect(await repository.sumByTurn("turn_1")).toEqual({
			usdMicros: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			byModel: [],
		});
	});

	it("reads zeros when the turn has no rows", async () => {
		const { execute, repository } = setup();
		execute.mockResolvedValue({ rows: [] });

		expect(await repository.sumByTurn("turn_none")).toEqual({
			usdMicros: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			byModel: [],
		});
	});
});
