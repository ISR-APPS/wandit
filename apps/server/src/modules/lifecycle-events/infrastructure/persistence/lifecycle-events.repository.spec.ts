import { db } from "@wandit/db";
import { lifecycleEvents } from "@wandit/db/schema/lifecycle-events";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import type { EnqueueLifecycleEvent } from "../../domain/lifecycle-event";
import {
	type LifecycleEventRow,
	LifecycleEventsRepository,
	type LifecycleEventsTransaction,
} from "./lifecycle-events.repository";

const NOW = new Date("2026-08-24T12:00:00.000Z");
const SELF_HEAL_NOW = new Date("2026-09-02T12:00:00.000Z");

function row(
	event: LifecycleEventRow["event"] = "signup_completed",
): LifecycleEventRow {
	return {
		attempts: 0,
		createdAt: NOW,
		dispatchAfter: NOW,
		dispatchedAt: null,
		dropReason: null,
		droppedAt: null,
		event,
		id: "11111111-1111-4111-8111-111111111111",
		idempotencyKey: `${event}:user-1`,
		lastError: null,
		payload: {},
		userId: "user-1",
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

	return {
		params: rendered.params,
		statement: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function insertClient(returnedRows: LifecycleEventRow[][]) {
	const returning = vi.fn(async () => returnedRows.shift() ?? []);
	const onConflictDoNothing = vi.fn(() => ({ returning }));
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));

	return { insert, onConflictDoNothing, returning, values };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("LifecycleEventsRepository.resolveSignupGrantCentiCredits", () => {
	it("prefers the user's snapshotted grant and falls back to current settings in SQL", async () => {
		const execute = vi.fn(async (_query: unknown) => ({
			rows: [{ credits: "5000" }],
		}));
		const repository = new LifecycleEventsRepository({
			execute,
		} as unknown as Database);

		await expect(
			repository.resolveSignupGrantCentiCredits("legacy-user"),
		).resolves.toBe(5000);

		const query = render(execute.mock.calls[0]?.[0]);
		expect(query.statement).toContain("from signup_grant_outbox signup_grant");
		expect(query.statement).toContain("from product_settings settings");
		expect(query.params).toEqual(["legacy-user", 1800]);
	});

	it("uses the caller's settlement transaction for the grant lookup", async () => {
		const rootExecute = vi.fn();
		const transactionExecute = vi.fn(async (_query: unknown) => ({
			rows: [{ credits: 700 }],
		}));
		const repository = new LifecycleEventsRepository({
			execute: rootExecute,
		} as unknown as Database);
		const transaction = {
			execute: transactionExecute,
		} as unknown as LifecycleEventsTransaction;

		await expect(
			repository.resolveSignupGrantCentiCredits("new-user", transaction),
		).resolves.toBe(700);
		expect(transactionExecute).toHaveBeenCalledOnce();
		expect(rootExecute).not.toHaveBeenCalled();
	});
});

describe("LifecycleEventsRepository.enqueue", () => {
	it("uses the canonical once-per-user key and ignores a replay", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const client = insertClient([[row()], []]);
		const repository = new LifecycleEventsRepository(
			client as unknown as Database,
		);
		const input = {
			event: "signup_completed",
			idempotencyKey: "capture-specific-key",
			userId: "user-1",
		} satisfies EnqueueLifecycleEvent;

		await expect(repository.enqueue(input)).resolves.toEqual(row());
		await expect(repository.enqueue(input)).resolves.toBeNull();

		expect(client.insert).toHaveBeenCalledWith(lifecycleEvents);
		expect(client.onConflictDoNothing).toHaveBeenCalledWith({
			target: lifecycleEvents.idempotencyKey,
		});
		expect(client.values).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				dispatchAfter: new Date("2026-08-24T12:10:00.000Z"),
				idempotencyKey: "signup_completed:user-1",
				payload: {},
			}),
		);
	});

	it("applies the 15-minute second credit-event hold by default", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const client = insertClient([[row("credits_40_used")]]);
		const repository = new LifecycleEventsRepository(
			client as unknown as Database,
		);

		await repository.enqueue({
			event: "credits_40_used",
			idempotencyKey: "ignored-for-once-event",
			userId: "user-1",
		});

		expect(client.values).toHaveBeenCalledWith(
			expect.objectContaining({
				dispatchAfter: new Date("2026-08-24T12:15:00.000Z"),
				idempotencyKey: "credits_40_used:user-1",
			}),
		);
	});

	it("rejects a pricing event inside cooldown under its advisory lock", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const limit = vi.fn(async () => [{ id: row().id }]);
		const where = vi.fn((_predicate: unknown) => ({ limit }));
		const from = vi.fn(() => ({ where }));
		const select = vi.fn(() => ({ from }));
		const execute = vi.fn(async (_query: unknown) => ({ rows: [] }));
		const txInsert = vi.fn();
		const tx = { execute, insert: txInsert, select };
		const transaction = vi.fn(
			async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
		);
		const repository = new LifecycleEventsRepository({
			transaction,
		} as unknown as Database);

		await expect(
			repository.enqueue({
				event: "pricing_viewed",
				idempotencyKey: "product:request-1",
				payload: { surface: "marketing_pricing" },
				userId: "user-1",
			}),
		).resolves.toBeNull();

		expect(transaction).toHaveBeenCalledOnce();
		expect(execute).toHaveBeenCalledOnce();
		expect(txInsert).not.toHaveBeenCalled();
		const lock = render(execute.mock.calls[0]?.[0]);
		expect(lock.statement).toContain("pg_advisory_xact_lock(hashtext($1))");
		expect(lock.params).toEqual(["lifecycle-event:pricing_viewed:user-1"]);
		const recent = render(where.mock.calls[0]?.[0]);
		expect(recent.params).toEqual([
			"user-1",
			"pricing_viewed",
			"2026-08-17T12:00:00.000Z",
		]);
	});

	it("accepts a pricing event after the cooldown and keeps its request key", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const limit = vi.fn(async () => []);
		const where = vi.fn((_predicate: unknown) => ({ limit }));
		const from = vi.fn(() => ({ where }));
		const select = vi.fn(() => ({ from }));
		const inserted = row("pricing_viewed");
		const insert = insertClient([[inserted]]);
		const tx = { execute: vi.fn(), insert: insert.insert, select };
		const transaction = vi.fn(
			async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
		);
		const repository = new LifecycleEventsRepository({
			transaction,
		} as unknown as Database);

		await expect(
			repository.enqueue({
				event: "pricing_viewed",
				idempotencyKey: "product:request-2",
				payload: { surface: "plan_picker" },
				userId: "user-1",
			}),
		).resolves.toEqual(inserted);

		expect(insert.values).toHaveBeenCalledWith({
			dispatchAfter: new Date("2026-08-24T12:15:00.000Z"),
			event: "pricing_viewed",
			idempotencyKey: "product:request-2",
			payload: { surface: "plan_picker" },
			userId: "user-1",
		});
	});
});

describe("LifecycleEventsRepository due and dispatch context queries", () => {
	it("self-heals recent signup rows in one conflict-safe insert-select", async () => {
		const execute = vi.fn(async (_query: unknown) => ({
			rows: [{ id: "event-1" }, { id: "event-2" }],
		}));
		const repository = new LifecycleEventsRepository({
			execute,
		} as unknown as Database);

		await expect(
			repository.healMissingSignupEvents(SELF_HEAL_NOW),
		).resolves.toBe(2);

		expect(execute).toHaveBeenCalledOnce();
		const query = render(execute.mock.calls[0]?.[0]);
		expect(query.statement).toContain('insert into "lifecycle_events"');
		expect(query.statement).toContain("'signup_completed:' || u.id");
		expect(query.statement).toContain('from "user" u');
		expect(query.statement).toContain(
			"where captured.idempotency_key = 'signup_completed:' || u.id",
		);
		expect(query.statement).toContain(
			"on conflict (idempotency_key) do nothing",
		);
		expect(query.statement).toContain("returning id");
		expect(query.params).toEqual([
			SELF_HEAL_NOW,
			new Date("2026-08-26T12:00:00.000Z"),
			SELF_HEAL_NOW,
		]);
	});

	it("lists only due non-terminal rows in stable chronological order", () => {
		const repository = new LifecycleEventsRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const query = repository["buildListDueQuery"](25, NOW).toSQL();
		const statement = query.sql.replaceAll(/\s+/g, " ").trim();

		expect(statement).toContain('"dispatched_at" is null');
		expect(statement).toContain('"dropped_at" is null');
		expect(statement).toContain('"dispatch_after" <= $1');
		expect(statement).toContain(
			'order by "lifecycle_events"."dispatch_after" asc, "lifecycle_events"."created_at" asc',
		);
		expect(statement).toContain("limit $2");
		expect(query.params).toEqual(["2026-08-24T12:00:00.000Z", 25]);
	});

	it("loads and maps all dispatcher facts in one query", async () => {
		const execute = vi.fn(async (_query: unknown) => ({
			rows: [
				{
					accepted_invitation: true,
					captured_events: ["website_generated"],
					email: "user@example.com",
					entitled_current_period_end: "2026-09-24T12:00:00.000Z",
					entitled_plan: "starter",
					entitled_provider: "manual",
					entitled_status: "active",
					has_first_prompt_event: true,
					has_open_personal_manual_request: false,
					has_personal_topup_receipt: false,
					name: "Amina Example",
				},
			],
		}));
		const repository = new LifecycleEventsRepository({
			execute,
		} as unknown as Database);

		await expect(
			repository.loadDispatchContext("user-1", NOW),
		).resolves.toEqual({
			acceptedInvitation: true,
			capturedEvents: ["website_generated"],
			entitledSubscription: {
				currentPeriodEnd: new Date("2026-09-24T12:00:00.000Z"),
				plan: "starter",
				provider: "manual",
				status: "active",
			},
			hasFirstPromptEvent: true,
			hasOpenPersonalManualRequest: false,
			hasPersonalTopupReceipt: false,
			user: { email: "user@example.com", name: "Amina Example" },
		});
		expect(execute).toHaveBeenCalledOnce();
		const contextQuery = render(execute.mock.calls[0]?.[0]);
		expect(contextQuery.statement).toContain(
			"s.provider <> 'manual' or s.current_period_end",
		);
		expect(contextQuery.statement).toContain("receipt.organization_id is null");
		expect(contextQuery.statement).toContain(
			"request.status in ('pending', 'contacted')",
		);
		expect(contextQuery.statement).toContain(
			"prompt.event = 'first_prompt_sent'",
		);
		expect(contextQuery.statement).toContain(
			"array_agg(distinct captured.event::text)",
		);
		expect(contextQuery.statement).not.toContain("captured.dispatched_at");
	});
});
