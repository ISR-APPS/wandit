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
});
