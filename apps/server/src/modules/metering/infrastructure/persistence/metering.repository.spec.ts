import { PgDialect, type SQL } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { MeteringRepository } from "./metering.repository";

const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "user_1";

type Rendered = { params: unknown[]; sql: string };

/** One `medianSettledCredits` row; a Postgres aggregate can arrive as a string. */
type MedianRow = { median: number | string | null };

/** One `monthlySpendCredits` row; the SUM arrives as a string. */
type TotalRow = { total: number | string | null };

/** One `countReservedByActor` row. */
type CountRow = { count: number };

const DIALECT = new PgDialect();

function render(query: SQL | undefined): Rendered {
	if (query === undefined) {
		throw new Error("render expects a drizzle SQL fragment");
	}

	const rendered = DIALECT.sqlToQuery(query);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

/**
 * Captures the SELECT builder's `where` input and the raw `execute` query.
 * The predicates render through the real dialect so the assertions cover the
 * exact SQL shape that reaches Postgres.
 */
function fakeClient(options: {
	executeRows?: (MedianRow | TotalRow)[];
	selectRows?: CountRow[];
}) {
	const calls: { query?: SQL; where?: SQL }[] = [];
	const selectRows = options.selectRows ?? [];

	const client: {
		execute: (query: SQL) => Promise<{ rows: (MedianRow | TotalRow)[] }>;
		select: Database["select"];
	} = {
		execute: vi.fn(async (query: SQL) => {
			calls.push({ query });
			return { rows: options.executeRows ?? [] };
		}),
		// SAFETY: the stub covers only the select().from().where() and
		// .orderBy().limit() chain the repository methods under test call.
		select: (() => ({
			from: () => ({
				where: (where: SQL) => {
					calls.push({ where });

					return Object.assign(Promise.resolve(selectRows), {
						orderBy: () => ({ limit: async () => selectRows }),
					});
				},
			}),
		})) as never,
	};

	// SAFETY: the stub covers only the execute/select surface the repository
	// methods under test call; the rest of Database is never touched.
	return { calls, client: client as Database };
}

function setup(options: {
	executeRows?: (MedianRow | TotalRow)[];
	selectRows?: CountRow[];
}) {
	const { calls, client } = fakeClient(options);
	const repository = new MeteringRepository(client);

	return { calls, client, repository };
}

describe("MeteringRepository agent-session queries", () => {
	it("medians the newest settled or reconciled finals of one project", async () => {
		const { calls, client, repository } = setup({
			executeRows: [{ median: 2_750.5 }],
		});

		await expect(
			repository.medianSettledCredits(PROJECT_ID, "agent_session", 10, client),
		).resolves.toBe(2_751);

		const query = render(calls[0]?.query);

		expect(query.sql).toContain(
			"percentile_cont(0.5) within group (order by t.final_credits)",
		);
		expect(query.sql).toContain("project_id = $1");
		expect(query.sql).toContain("operation = $2");
		expect(query.sql).toContain("status in ('settled', 'reconciled')");
		expect(query.sql).toContain("final_credits is not null");
		expect(query.sql).toContain(
			"order by settled_at desc nulls last, created_at desc",
		);
		expect(query.sql).toContain("limit $3");
		expect(query.params).toEqual([PROJECT_ID, "agent_session", 10]);
	});

	it("answers null when no settled row qualifies", async () => {
		const { client, repository } = setup({
			executeRows: [{ median: null }],
		});

		await expect(
			repository.medianSettledCredits(PROJECT_ID, "agent_session", 10, client),
		).resolves.toBeNull();
	});

	it("sums agent-session spend at the hold while a turn still runs", async () => {
		const { calls, client, repository } = setup({
			executeRows: [{ total: "4200" }],
		});
		const monthStart = new Date("2026-08-01T00:00:00.000Z");

		await expect(
			repository.monthlySpendCredits(PROJECT_ID, monthStart, client),
		).resolves.toBe(4_200);

		const query = render(calls[0]?.query);

		expect(query.sql).toContain(
			"coalesce(sum(coalesce(final_credits, reserved_credits)), 0)",
		);
		expect(query.sql).toContain("project_id = $1");
		expect(query.sql).toContain("operation = $2");
		expect(query.sql).toContain("created_at >= $3");
		expect(query.sql).toContain("status <> $4");
		expect(query.params).toEqual([
			PROJECT_ID,
			"agent_session",
			monthStart,
			"refunded",
		]);
	});

	it("counts reserved holds of one operation for one actor", async () => {
		const { calls, client, repository } = setup({
			selectRows: [{ count: 2 }],
		});

		await expect(
			repository.countReservedByActor("agent_session", USER_ID, client),
		).resolves.toBe(2);

		const where = render(calls[0]?.where);

		expect(where.sql).toBe(
			'("ai_usage_events"."operation" = $1 and "ai_usage_events"."status" = $2 and "ai_usage_events"."user_id" = $3)',
		);
		expect(where.params).toEqual(["agent_session", "reserved", USER_ID]);
	});

	it("pages settled agent sessions inside the settled-at window, oldest first", async () => {
		const { calls, client, repository } = setup({ selectRows: [] });
		const olderThan = new Date("2026-08-02T00:00:00.000Z");
		const youngerThan = new Date("2026-08-01T00:00:00.000Z");

		await repository.listSettledAgentSessions(
			olderThan,
			youngerThan,
			50,
			client,
		);

		const where = render(calls[0]?.where);

		expect(where.sql).toBe(
			'("ai_usage_events"."operation" = $1 and "ai_usage_events"."status" = $2 and "ai_usage_events"."settled_at" < $3 and "ai_usage_events"."settled_at" > $4)',
		);
		expect(where.params).toEqual([
			"agent_session",
			"settled",
			olderThan.toISOString(),
			youngerThan.toISOString(),
		]);
	});
});

describe("MeteringRepository listStaleReserved operation windows", () => {
	it("applies one cutoff when no agent-session date is given", async () => {
		const { calls, client, repository } = setup({ selectRows: [] });
		const createdBefore = new Date("2026-08-01T00:00:00.000Z");

		await repository.listStaleReserved(createdBefore, 10, client);

		const where = render(calls[0]?.where);

		expect(where.sql).not.toContain('"ai_usage_events"."operation"');
		expect(where.params[0]).toBe("reserved");
		expect(where.params[1]).toBe(createdBefore.toISOString());
	});

	it("splits the cutoff per operation when an agent-session date is given", async () => {
		const { calls, client, repository } = setup({ selectRows: [] });
		const createdBefore = new Date("2026-08-01T00:40:00.000Z");
		const agentSessionBefore = new Date("2026-08-01T00:00:00.000Z");

		await repository.listStaleReserved(
			createdBefore,
			10,
			client,
			agentSessionBefore,
		);

		const where = render(calls[0]?.where);

		expect(where.sql).toContain('"ai_usage_events"."operation" = $2');
		expect(where.sql).toContain('"ai_usage_events"."created_at" < $3');
		expect(where.sql).toContain('"ai_usage_events"."operation" <> $4');
		expect(where.sql).toContain('"ai_usage_events"."created_at" < $5');
		expect(where.params[0]).toBe("reserved");
		expect(where.params[1]).toBe("agent_session");
		expect(where.params[2]).toBe(agentSessionBefore.toISOString());
		expect(where.params[3]).toBe("agent_session");
		expect(where.params[4]).toBe(createdBefore.toISOString());
	});
});
