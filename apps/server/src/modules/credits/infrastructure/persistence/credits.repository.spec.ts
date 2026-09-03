import { db } from "@wandit/db";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { orgOwner, userOwner } from "../../domain/credit-owner";
import { CreditsRepository } from "./credits.repository";

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

describe("CreditsRepository reserved add-back query", () => {
	it("sums reserved usage events for a personal owner with the org-null predicate", () => {
		const repository = new CreditsRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const query = repository["buildSumReservedQuery"](
			userOwner("user-1"),
		).toSQL();
		const statement = normalizeSql(query.sql);

		expect(statement).toContain('coalesce(sum("reserved_credits"), 0)::int');
		expect(statement).toContain('from "ai_usage_events"');
		// In flight = reserved, or reconcile_failed straight from reserved (no
		// refund row was written, so the reserve dip is still open).
		expect(statement).toContain(
			'("ai_usage_events"."status" = \'reserved\' or ("ai_usage_events"."status" = \'reconcile_failed\' and "ai_usage_events"."final_credits" is null))',
		);
		expect(statement).toContain('"ai_usage_events"."user_id" = $1');
		expect(statement).toContain('"ai_usage_events"."organization_id" is null');
		expect(query.params).toEqual(["user-1"]);
	});

	it("sums reserved usage events for the org pool regardless of the acting member", () => {
		const repository = new CreditsRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const query = repository["buildSumReservedQuery"](
			orgOwner("org-1"),
		).toSQL();
		const statement = normalizeSql(query.sql);

		expect(statement).toContain('"ai_usage_events"."status" = \'reserved\'');
		expect(statement).toContain('"ai_usage_events"."organization_id" = $1');
		// The acting member never narrows the org pool's add-back.
		expect(statement).not.toContain('"user_id"');
		expect(query.params).toEqual(["org-1"]);
	});
});

function fakeClient(row: Record<string, unknown> | undefined) {
	const executed: unknown[] = [];

	return {
		client: {
			execute: async (query: unknown) => {
				executed.push(query);

				return { rows: row ? [row] : [] };
			},
		} as unknown as Database,
		executed,
	};
}

function render(query: unknown) {
	const rendered = (
		db as unknown as {
			dialect: {
				sqlToQuery(query: unknown): { params: unknown[]; sql: string };
			};
		}
	).dialect.sqlToQuery(query);

	return { params: rendered.params, statement: normalizeSql(rendered.sql) };
}

describe("CreditsRepository.netConsumedCentiCredits", () => {
	it("counts personal consumes net of metering refunds in one query", async () => {
		const repository = new CreditsRepository(db as Database);
		const { client, executed } = fakeClient({ total: "2500" });

		await expect(
			repository.netConsumedCentiCredits("user-1", client),
		).resolves.toBe(2500);
		expect(executed).toHaveLength(1);

		const { params, statement } = render(executed[0]);

		expect(statement).toContain(
			'select coalesce(-sum("credit_ledger"."delta"), 0)::int as total',
		);
		expect(statement).toContain('"credit_ledger"."user_id" = $1');
		expect(statement).toContain('"credit_ledger"."organization_id" is null');
		expect(statement).toContain('"credit_ledger"."kind" = \'consume\'');
		expect(statement).toContain(
			'"credit_ledger"."idempotency_key" like \'settle-refund:%\'',
		);
		expect(statement).toContain(
			'"credit_ledger"."idempotency_key" like \'reconcile-refund:%\'',
		);
		expect(statement).toContain(
			'"credit_ledger"."idempotency_key" like \'refund:%\'',
		);
		expect(params).toEqual(["user-1"]);
	});

	it("returns zero for an empty personal ledger", async () => {
		const repository = new CreditsRepository(db as Database);
		const { client } = fakeClient({ total: null });

		await expect(
			repository.netConsumedCentiCredits("user-1", client),
		).resolves.toBe(0);
	});
});

describe("CreditsRepository.getSettledBalanceSnapshot", () => {
	it("adds each bucket's open hold back from ONE statement", async () => {
		const repository = new CreditsRepository(db as Database);
		// Ledger after a 100 cc reserve split 60 plan + 40 promo on a
		// 1000/100/0 wallet: plan 940, promo 60, topup 0.
		const { client, executed } = fakeClient({
			hold_plan: "60",
			hold_promo: 40,
			hold_topup: 0,
			plan: "940",
			promo: 60,
			topup: 0,
		});

		const snapshot = await repository.getSettledBalanceSnapshot(
			userOwner("user-1"),
			client,
		);

		// While the event is in flight the settled buckets read pre-reserve.
		expect(snapshot).toEqual({
			balance: 1000,
			plan: 940,
			promo: 60,
			settledBalance: 1100,
			settledPlan: 1000,
			settledPromo: 100,
			settledTopup: 0,
			topup: 0,
		});
		expect(snapshot.settledBalance).toBe(
			snapshot.settledPlan + snapshot.settledPromo + snapshot.settledTopup,
		);
		expect(executed).toHaveLength(1);

		const { params, statement } = render(executed[0]);

		expect(statement).toContain('from "credit_ledger"');
		expect(statement).toContain('from "ai_usage_events"');
		expect(statement).toContain('"ai_usage_events"."organization_id" is null');
		// Holds come from the reserve consume rows keyed reserve:<id>:<bucket>,
		// for reserved OR reconcile_failed-without-final_credits events.
		expect(statement).toContain(
			'("ai_usage_events"."status" = \'reserved\' or ("ai_usage_events"."status" = \'reconcile_failed\' and "ai_usage_events"."final_credits" is null))',
		);
		expect(statement).toContain("'reserve:' || inflight.id::text || ':plan'");
		expect(statement).toContain("'reserve:' || inflight.id::text || ':promo'");
		expect(statement).toContain("'reserve:' || inflight.id::text || ':topup'");
		expect(statement).toContain('"credit_ledger"."kind" = \'consume\'');
		expect(params).toContain("user-1");
	});

	it("reads the buckets minus the final charge once the event settled (no hold)", async () => {
		const repository = new CreditsRepository(db as Database);
		// Settle at F = 37 refunded 63 onto plan: plan 963, promo 100.
		const { client } = fakeClient({
			hold_plan: 0,
			hold_promo: 0,
			hold_topup: 0,
			plan: 963,
			promo: 100,
			topup: 0,
		});

		await expect(
			repository.getSettledBalanceSnapshot(userOwner("user-1"), client),
		).resolves.toEqual({
			balance: 1063,
			plan: 963,
			promo: 100,
			settledBalance: 1063,
			settledPlan: 963,
			settledPromo: 100,
			settledTopup: 0,
			topup: 0,
		});
	});

	it("treats a missing row as an empty ledger", async () => {
		const repository = new CreditsRepository(db as Database);
		const { client } = fakeClient(undefined);

		await expect(
			repository.getSettledBalanceSnapshot(orgOwner("org-1"), client),
		).resolves.toEqual({
			balance: 0,
			plan: 0,
			promo: 0,
			settledBalance: 0,
			settledPlan: 0,
			settledPromo: 0,
			settledTopup: 0,
			topup: 0,
		});
	});
});

describe("CreditsRepository.listActivityByOwner", () => {
	it("unions top-level usage events with non-usage ledger rows in ONE statement", async () => {
		const repository = new CreditsRepository(db as Database);
		const { client, executed } = fakeClient({
			items: [
				{
					bucket: null,
					created_at: "2026-08-20T10:00:00+00:00",
					delta: null,
					final_credits: 39,
					finalized_at: "2026-08-20T10:02:00+00:00",
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e02",
					ledger_kind: null,
					operation: "chat",
					reason: null,
					reserved_credits: 100,
					source: "usage",
					status: "reconciled",
				},
				{
					bucket: "promo",
					created_at: "2026-08-19T09:00:00+00:00",
					delta: 500,
					final_credits: null,
					finalized_at: null,
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e03",
					ledger_kind: "grant",
					operation: null,
					reason: "signup_grant",
					reserved_credits: null,
					source: "ledger",
					status: null,
				},
			],
			total: "7",
		});

		const page = await repository.listActivityByOwner(
			userOwner("user-1"),
			{ page: 2, pageSize: 2 },
			client,
		);

		expect(page).toEqual({
			items: [
				{
					createdAt: new Date("2026-08-20T10:00:00.000Z"),
					finalCredits: 39,
					finalizedAt: new Date("2026-08-20T10:02:00.000Z"),
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e02",
					operation: "chat",
					reservedCredits: 100,
					source: "usage",
					status: "reconciled",
				},
				{
					bucket: "promo",
					createdAt: new Date("2026-08-19T09:00:00.000Z"),
					delta: 500,
					id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e03",
					ledgerKind: "grant",
					reason: "signup_grant",
					source: "ledger",
				},
			],
			page: 2,
			pageSize: 2,
			total: 7,
		});
		expect(executed).toHaveLength(1);

		const { params, statement } = render(executed[0]);

		expect(statement).toContain("union all");
		// Child events (image/video/... started from chat) own their own debit,
		// so they get their own row: no parent filter.
		expect(statement).not.toContain("parent_event_id");
		// Refunded events with nothing charged are hidden server-side.
		expect(statement).toContain(
			'not ( "ai_usage_events"."status" = \'refunded\' and coalesce("ai_usage_events"."final_credits", 0) = 0 )',
		);
		// Every metering ledger row carries meta.usageEventId; the rest are
		// grants, topups, expire and revoke rows.
		expect(statement).toContain(
			'"credit_ledger"."meta" ->> \'usageEventId\' is null',
		);
		// An in-flight row (same predicate as the balance add-back) has no
		// finalized_at, even when a reconcile attempt stamped reconciled_at.
		expect(statement).toContain(
			'case when ("ai_usage_events"."status" = \'reserved\' or ("ai_usage_events"."status" = \'reconcile_failed\' and "ai_usage_events"."final_credits" is null)) then null else coalesce("ai_usage_events"."reconciled_at", "ai_usage_events"."settled_at") end as finalized_at',
		);
		expect(statement).toContain("order by created_at desc, id desc");
		expect(statement).toContain(
			"(select count(*)::int from combined) as total",
		);
		expect(statement).toContain('"credit_ledger"."organization_id" is null');
		expect(statement).toContain('"ai_usage_events"."organization_id" is null');
		// limit 2, offset (2 - 1) * 2 = 2.
		expect(params).toEqual(["user-1", "user-1", 2, 2]);
	});

	it("parses a JSON-string items column and an empty page", async () => {
		const repository = new CreditsRepository(db as Database);
		const { client } = fakeClient({ items: "[]", total: 3 });

		await expect(
			repository.listActivityByOwner(
				orgOwner("org-1"),
				{ page: 5, pageSize: 1 },
				client,
			),
		).resolves.toEqual({ items: [], page: 5, pageSize: 1, total: 3 });
	});
});
