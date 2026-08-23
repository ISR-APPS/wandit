import { db } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { MeteringRepository } from "./metering.repository";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "22222222-2222-4222-8222-222222222222";

type Rendered = { params: unknown[]; sql: string };

function render(query: unknown): Rendered {
	const dialect = (
		db as unknown as { dialect: { sqlToQuery(query: unknown): Rendered } }
	).dialect;
	const rendered = dialect.sqlToQuery(query);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

/**
 * Captures the UPDATE/SELECT builders' `set` and `where` inputs. The
 * predicates are drizzle SQL fragments, rendered through the real dialect so
 * the assertions cover the exact CAS shape that reaches Postgres.
 */
function fakeClient(returned: unknown[]) {
	const calls: { set?: Record<string, unknown>; where?: unknown }[] = [];

	const client = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn((where: unknown) => {
					calls.push({ where });

					return {
						orderBy: vi.fn(() => ({
							limit: vi.fn(async () => returned),
						})),
					};
				}),
			})),
		})),
		update: vi.fn(() => ({
			set: vi.fn((set: Record<string, unknown>) => ({
				where: vi.fn((where: unknown) => {
					calls.push({ set, where });
					const result = Promise.resolve(returned);

					return Object.assign(result, {
						returning: vi.fn(async () => returned),
					});
				}),
			})),
		})),
	};

	return { calls, client: client as unknown as Database };
}

function setup(returned: unknown[]) {
	const { calls, client } = fakeClient(returned);
	const repository = new MeteringRepository(client);

	return { calls, client, repository };
}

describe("MeteringRepository execution lease CAS", () => {
	it("acquires only a still-reserved row whose lease is absent or expired", async () => {
		const { calls, client, repository } = setup([{ id: EVENT_ID }]);

		await expect(
			repository.acquireExecutionLease(EVENT_ID, TOKEN, 300_000, client),
		).resolves.toEqual({ id: EVENT_ID });

		const [call] = calls;
		const where = render(call?.where);

		expect(call?.set).toMatchObject({ executionLeaseToken: TOKEN });
		expect(render(call?.set?.executionLeaseExpiresAt).sql).toBe(
			"now() + ($1 * interval '1 millisecond')",
		);
		expect(where.sql).toBe(
			'("ai_usage_events"."id" = $1 and "ai_usage_events"."status" = $2 and ("ai_usage_events"."execution_lease_token" is null or "ai_usage_events"."execution_lease_expires_at" < now()))',
		);
		expect(where.params).toEqual([EVENT_ID, "reserved"]);
	});

	it("returns null when another holder owns a live lease", async () => {
		const { client, repository } = setup([]);

		await expect(
			repository.acquireExecutionLease(EVENT_ID, TOKEN, 300_000, client),
		).resolves.toBeNull();
	});

	it("heartbeats only while this token still owns the reserved row", async () => {
		const { calls, client, repository } = setup([{ id: EVENT_ID }]);

		await expect(
			repository.heartbeatExecutionLease(EVENT_ID, TOKEN, 300_000, client),
		).resolves.toBe(true);

		const [call] = calls;
		const where = render(call?.where);

		expect(Object.keys(call?.set ?? {})).toEqual(["executionLeaseExpiresAt"]);
		expect(where.sql).toBe(
			'("ai_usage_events"."id" = $1 and "ai_usage_events"."status" = $2 and "ai_usage_events"."execution_lease_token" = $3)',
		);
		expect(where.params).toEqual([EVENT_ID, "reserved", TOKEN]);
	});

	it("reports a lost heartbeat CAS as false", async () => {
		const { client, repository } = setup([]);

		await expect(
			repository.heartbeatExecutionLease(EVENT_ID, TOKEN, 300_000, client),
		).resolves.toBe(false);
	});

	it("releases both lease columns only for the owning token", async () => {
		const { calls, client, repository } = setup([]);

		await repository.releaseExecutionLease(EVENT_ID, TOKEN, client);

		const [call] = calls;
		const where = render(call?.where);

		expect(call?.set).toEqual({
			executionLeaseExpiresAt: null,
			executionLeaseToken: null,
		});
		expect(where.sql).toBe(
			'("ai_usage_events"."id" = $1 and "ai_usage_events"."execution_lease_token" = $2)',
		);
		expect(where.params).toEqual([EVENT_ID, TOKEN]);
	});

	it("rejects a non-positive lease TTL before touching the database", async () => {
		const { calls, client, repository } = setup([]);

		await expect(
			repository.acquireExecutionLease(EVENT_ID, TOKEN, 0, client),
		).rejects.toThrow("Execution lease TTL must be a positive integer");
		expect(calls).toHaveLength(0);
	});
});

describe("MeteringRepository sweep selections", () => {
	it("excludes live-leased holds from the stranded sweep and includes expired ones", async () => {
		const { calls, client, repository } = setup([]);
		const createdBefore = new Date("2026-08-01T00:00:00.000Z");

		await repository.listStaleReserved(createdBefore, 10, client);

		const where = render(calls[0]?.where);

		expect(where.sql).toBe(
			'("ai_usage_events"."status" = $1 and "ai_usage_events"."created_at" < $2 and ("ai_usage_events"."execution_lease_expires_at" is null or "ai_usage_events"."execution_lease_expires_at" < now()))',
		);
		// Drizzle renders the Date param in its own wire format.
		expect(where.params).toEqual(["reserved", expect.anything()]);
	});

	it("selects only due reconcile_failed retries (dead-lettered NULL never matches)", async () => {
		const { calls, client, repository } = setup([]);
		const now = new Date("2026-08-01T00:00:00.000Z");

		await repository.listRetryableReconcileFailed(now, 10, client);

		const where = render(calls[0]?.where);

		expect(where.sql).toBe(
			'("ai_usage_events"."status" = $1 and "ai_usage_events"."next_reconcile_attempt_at" <= $2)',
		);
		expect(where.params).toEqual(["reconcile_failed", expect.anything()]);
	});

	it("selects settled events that have no generation refs at all", async () => {
		const { calls, client, repository } = setup([]);
		const createdBefore = new Date("2026-08-01T00:00:00.000Z");

		await repository.listSettledWithoutRefs(createdBefore, 10, client);

		const where = render(calls[0]?.where);

		expect(where.sql).toContain('"ai_usage_events"."status" = $1');
		expect(where.sql).toContain(
			'not exists ( select 1 from "ai_usage_generation_refs" where "ai_usage_generation_refs"."usage_event_id" = "ai_usage_events"."id" )',
		);
		expect(where.params).toEqual(["settled", expect.anything()]);
	});
});
