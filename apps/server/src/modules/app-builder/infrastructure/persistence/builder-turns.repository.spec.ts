import { PgDialect, db as realDb } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { BuilderTurnActiveError } from "../../domain/errors/builder-turn-active.error";
import {
	BuilderTurnsRepository,
	isUniqueViolation,
} from "./builder-turns.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: unknown) {
	// SAFETY: the fake db captures real drizzle SQL wrappers as this arg.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

/**
 * Fake db for update paths: `update → set → where → returning`. The where
 * argument is a real drizzle SQL fragment the spec renders. `select` is
 * the real drizzle builder so a method can embed a compiled subquery.
 */
function updateClient(returned: unknown[]) {
	const captured: { set?: unknown; where?: unknown } = {};
	const returning = vi.fn(async () => returned);
	const where = vi.fn((w: unknown) => {
		captured.where = w;
		return { returning };
	});
	const set = vi.fn((s: unknown) => {
		captured.set = s;
		return { where };
	});
	const update = vi.fn(() => ({ set }));

	return {
		captured,
		repository: new BuilderTurnsRepository(
			// SAFETY: `Object.create` yields `any`; the stub exposes only the
			// select and update chains the repository methods call.
			Object.assign(Object.create(null), {
				select: realDb.select.bind(realDb),
				update,
			}) as Database,
		),
		returning,
		set,
		where,
	};
}

/** Fake db for select paths: `select → from → where → limit` (awaited). */
function selectClient(rows: unknown[]) {
	const captured: { where?: unknown } = {};
	const limit = vi.fn(async () => rows);
	const where = vi.fn((w: unknown) => {
		captured.where = w;
		return { limit };
	});
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));

	return {
		captured,
		repository: new BuilderTurnsRepository({
			select,
		} as unknown as Database),
	};
}

describe("BuilderTurnsRepository CAS predicates", () => {
	it("transition gates on id plus an IN list of from-statuses", async () => {
		const { captured, repository } = updateClient([{ id: "turn-1" }]);

		const moved = await repository.transition(
			"turn-1",
			["queued", "running"],
			"cancelling",
			{ error: null },
		);

		expect(moved).toBe(true);
		expect(captured.set).toMatchObject({
			error: null,
			status: "cancelling",
		});
		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_turns"."id" = $1');
		expect(sql).toContain('"builder_turns"."status" in ($2, $3)');
		expect(params).toEqual(["turn-1", "queued", "running"]);
	});

	it("transition returns false when no row matches the CAS", async () => {
		const { repository } = updateClient([]);

		await expect(
			repository.transition("turn-1", ["queued"], "running"),
		).resolves.toBe(false);
	});

	it("transition returns false when the write hits the active-slot index", async () => {
		// Cancel moving a waiting_for_answer row to cancelling while another
		// row holds the slot: the 23505 is a lost CAS, not a 500.
		const { repository, returning } = updateClient([]);
		returning.mockRejectedValueOnce(
			Object.assign(new Error("dup"), { code: "23505" }),
		);

		await expect(
			repository.transition("turn-1", ["waiting_for_answer"], "cancelling"),
		).resolves.toBe(false);
	});

	it("claimRunning requires status queued and a free or matching run id", async () => {
		const { captured, repository } = updateClient([{ id: "turn-1" }]);

		await expect(repository.claimRunning("turn-1", "run-9")).resolves.toBe(
			true,
		);

		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_turns"."status" = $2');
		expect(sql).toContain('"builder_turns"."trigger_run_id" is null');
		expect(sql).toContain('"builder_turns"."trigger_run_id" = $3');
		expect(params).toEqual(["turn-1", "queued", "run-9"]);
	});

	it("complete only lands from running or cancelling", async () => {
		const { captured, repository } = updateClient([]);

		await repository.complete("turn-1", {
			completedAt: new Date(0),
			outputCommitSha: "abc",
			status: "succeeded",
		});

		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_turns"."status" in ($2, $3)');
		expect(params).toEqual(["turn-1", "running", "cancelling"]);
	});

	it("fail refuses to resurrect a terminal row", async () => {
		const { captured, repository } = updateClient([]);

		await repository.fail("turn-1", {
			error: "boom",
			failureCode: null,
			failureKind: null,
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: null,
			sentryEventId: null,
		});

		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_turns"."status" not in');
		expect(params.slice(1)).toEqual([
			"succeeded",
			"failed",
			"canceled",
			"stalled",
			"stopped_no_credits",
			"stopped_project_cap",
			"stopped_disabled",
		]);
	});

	it("promoteOldestWaiting re-checks waiting under the update", async () => {
		const { captured, repository } = updateClient([{ id: "turn-1" }]);

		await repository.promoteOldestWaiting("project-1");

		expect(captured.set).toMatchObject({ status: "queued" });
		const { params, sql } = compile(captured.where);
		// The embedded subquery picks the oldest waiting row by turnNumber.
		expect(sql).toContain('"builder_turns"."project_id" = $1');
		expect(sql).toContain('"builder_turns"."status" = $2');
		expect(sql).toContain('order by "builder_turns"."turn_number" asc');
		expect(sql).toContain("limit $3");
		// The outer clause re-checks `waiting` so a raced flip cannot fire.
		expect(sql).toContain('and "builder_turns"."status" = $4');
		expect(params).toEqual(["project-1", "waiting", 1, "waiting"]);
	});

	it("promoteOldestWaiting answers null on the active-slot 23505", async () => {
		// The slot was taken between the read and the flip: the update's
		// 23505 means "still busy", so the method answers null.
		const where = vi.fn(() => ({
			returning: vi.fn(async () => {
				throw Object.assign(new Error("dup"), { code: "23505" });
			}),
		}));
		const set = vi.fn(() => ({ where }));
		const update = vi.fn(() => ({ set }));

		const repository = new BuilderTurnsRepository(
			// SAFETY: `Object.create` yields `any`; `select` is the real
			// builder (the subquery is compiled, never executed) and `update`
			// is the throwing fake above.
			Object.assign(Object.create(null), {
				select: realDb.select.bind(realDb),
				update,
			}) as Database,
		);

		await expect(
			repository.promoteOldestWaiting("project-1"),
		).resolves.toBeNull();
	});
});

describe("BuilderTurnsRepository active-status reads", () => {
	it("findActiveForProject filters on the three slot-holding statuses", async () => {
		const { captured, repository } = selectClient([]);

		await repository.findActiveForProject("project-1");

		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_turns"."project_id" = $1');
		expect(sql).toContain('"builder_turns"."status" in ($2, $3, $4)');
		expect(params).toEqual(["project-1", "queued", "running", "cancelling"]);
	});

	it("findActiveForChat adds waiting and the user-blocked statuses", async () => {
		const { captured, repository } = selectClient([]);

		await repository.findActiveForChat("chat-1");

		const { params } = compile(captured.where);
		expect(params).toEqual([
			"chat-1",
			"queued",
			"waiting",
			"running",
			"cancelling",
			"waiting_for_answer",
			"waiting_for_approval",
		]);
	});

	it("findOldestWaiting orders parked rows by turnNumber", async () => {
		const captured: { orderBy?: unknown; where?: unknown } = {};
		const limit = vi.fn(async () => []);
		const orderBy = vi.fn((o: unknown) => {
			captured.orderBy = o;
			return { limit };
		});
		const where = vi.fn((w: unknown) => {
			captured.where = w;
			return { orderBy };
		});
		const from = vi.fn(() => ({ where }));
		const select = vi.fn(() => ({ from }));
		const repository = new BuilderTurnsRepository(
			// SAFETY: `Object.create` yields `any`; the fake captures the
			// drizzle fragments and nothing executes.
			Object.assign(Object.create(null), { select }) as Database,
		);

		await repository.findOldestWaiting("project-1");

		const whereClause = compile(captured.where);
		expect(whereClause.sql).toContain('"builder_turns"."project_id" = $1');
		expect(whereClause.sql).toContain('"builder_turns"."status" = $2');
		expect(whereClause.params).toEqual(["project-1", "waiting"]);
		expect(compile(captured.orderBy).sql).toContain(
			'"builder_turns"."turn_number" asc',
		);
	});

	it("findWaitingForUser picks the oldest paused row of the project", async () => {
		const captured: { orderBy?: unknown; where?: unknown } = {};
		const limit = vi.fn(async () => []);
		const orderBy = vi.fn((o: unknown) => {
			captured.orderBy = o;
			return { limit };
		});
		const where = vi.fn((w: unknown) => {
			captured.where = w;
			return { orderBy };
		});
		const from = vi.fn(() => ({ where }));
		const select = vi.fn(() => ({ from }));
		const repository = new BuilderTurnsRepository(
			// SAFETY: `Object.create` yields `any`; the fake captures the
			// drizzle fragments and nothing executes.
			Object.assign(Object.create(null), { select }) as Database,
		);

		await repository.findWaitingForUser("project-1");

		const whereClause = compile(captured.where);
		expect(whereClause.sql).toContain('"builder_turns"."project_id" = $1');
		expect(whereClause.sql).toContain('"builder_turns"."status" in ($2, $3)');
		expect(whereClause.params).toEqual([
			"project-1",
			"waiting_for_answer",
			"waiting_for_approval",
		]);
		expect(compile(captured.orderBy).sql).toContain(
			'"builder_turns"."turn_number" asc',
		);
	});

	it("currentTurnNumber counts only the slot-holding statuses", async () => {
		const captured: { where?: unknown } = {};
		const where = vi.fn(async (w: unknown) => {
			captured.where = w;
			return [{ max: 3 }];
		});
		const from = vi.fn(() => ({ where }));
		const select = vi.fn(() => ({ from }));
		const repository = new BuilderTurnsRepository(
			// SAFETY: `Object.create` yields `any`; the fake captures the
			// drizzle fragments and nothing executes.
			Object.assign(Object.create(null), { select }) as Database,
		);

		expect(await repository.currentTurnNumber("project-1")).toBe(3);

		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_turns"."project_id" = $1');
		expect(sql).toContain('"builder_turns"."status" in ($2, $3, $4)');
		expect(params).toEqual(["project-1", "queued", "running", "cancelling"]);
	});
});

describe("BuilderTurnsRepository.create", () => {
	// Fake tx: select → from → where → for|awaited; insert → values → returning.
	function txClient(options: {
		insertError?: unknown;
		max?: number;
		returnedRow?: unknown;
		requestKeyRow?: unknown;
	}) {
		const insertValues: unknown[] = [];
		const returning = vi.fn(async () =>
			options.returnedRow ? [options.returnedRow] : [],
		);
		const values = vi.fn((v: unknown) => {
			insertValues.push(v);
			return {
				returning: options.insertError
					? vi.fn(async () => {
							throw options.insertError;
						})
					: returning,
			};
		});
		const insert = vi.fn(() => ({ values }));

		let selectCall = 0;
		const forUpdate = vi.fn(async () => [{ id: "project-1" }]);
		const select = vi.fn(() => {
			selectCall += 1;
			if (selectCall === 1) {
				return {
					from: vi.fn(() => ({ where: vi.fn(() => ({ for: forUpdate })) })),
				};
			}
			return {
				from: vi.fn(() => ({
					where: vi.fn(async () => [{ max: options.max ?? 0 }]),
				})),
			};
		});

		// The replay path re-reads through `findByRequestKey` on `this.db`.
		const requestKeyLimit = vi.fn(async () =>
			options.requestKeyRow ? [options.requestKeyRow] : [],
		);
		const dbSelect = vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: requestKeyLimit })),
			})),
		}));

		const db = {
			select: dbSelect,
			transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
				callback({ insert, select }),
			),
		};

		return {
			db,
			forUpdate,
			insertValues,
			repository: new BuilderTurnsRepository(db as unknown as Database),
		};
	}

	it("allocates turnNumber as max + 1 inside the locked transaction", async () => {
		const row = { id: "turn-1", turnNumber: 4 };
		const { insertValues, repository } = txClient({
			max: 3,
			returnedRow: row,
		});

		const result = await repository.create({
			chatId: "chat-1",
			harness: "claude_code",
			id: "turn-1",
			messageId: "message-1",
			model: null,
			organizationId: null,
			projectId: "project-1",
			requestKey: "turn-1",
			sessionId: "session-1",
			spec: { attachments: [], composer: null, message: "hi" },
			status: "queued",
			userId: "user-1",
		});

		expect(result).toEqual({ replayed: false, turn: row });
		expect(insertValues[0]).toMatchObject({ turnNumber: 4 });
	});

	it("adopts the existing row when (chatId, requestKey) already exists", async () => {
		const existing = { id: "turn-1", requestKey: "turn-1" };
		const { repository } = txClient({
			insertError: Object.assign(new Error("dup"), { code: "23505" }),
			requestKeyRow: existing,
		});

		const result = await repository.create({
			chatId: "chat-1",
			harness: "claude_code",
			id: "turn-1",
			messageId: "message-1",
			model: null,
			organizationId: null,
			projectId: "project-1",
			requestKey: "turn-1",
			sessionId: "session-1",
			spec: { attachments: [], composer: null, message: "hi" },
			status: "queued",
			userId: "user-1",
		});

		expect(result).toEqual({ replayed: true, turn: existing });
	});

	it("turns an active-slot unique violation into BuilderTurnActiveError", async () => {
		const { repository } = txClient({
			insertError: Object.assign(new Error("dup"), { code: "23505" }),
		});

		await expect(
			repository.create({
				chatId: "chat-1",
				harness: "claude_code",
				id: "turn-2",
				messageId: "message-2",
				model: null,
				organizationId: null,
				projectId: "project-1",
				requestKey: "turn-2",
				sessionId: "session-1",
				spec: { attachments: [], composer: null, message: "hi" },
				status: "queued",
				userId: "user-1",
			}),
		).rejects.toBeInstanceOf(BuilderTurnActiveError);
	});
});

describe("isUniqueViolation", () => {
	it("finds 23505 on the error and inside a Drizzle-wrapped cause", () => {
		expect(isUniqueViolation(new Error("plain"))).toBe(false);
		expect(
			isUniqueViolation(Object.assign(new Error("dup"), { code: "23505" })),
		).toBe(true);
		expect(
			isUniqueViolation(
				new Error("wrapped", {
					cause: Object.assign(new Error("dup"), { code: "23505" }),
				}),
			),
		).toBe(true);
	});
});
