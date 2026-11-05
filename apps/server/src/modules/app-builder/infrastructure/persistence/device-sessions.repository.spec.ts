import { PgDialect } from "@wandit/db";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { orgOwner, userOwner } from "../../../credits/domain/credit-owner";
import {
	type DeviceSessionRow,
	DeviceSessionsRepository,
} from "./device-sessions.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

/** Renders one drizzle SQL chunk as text plus its params. */
function compile(query: unknown) {
	// SAFETY: the chain stub receives real drizzle SQL chunks from the repository.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);
	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

/**
 * A query-builder stub: every builder method records its arguments. `where`,
 * `limit`, and `returning` answer a real Promise of `rows` that also carries
 * the builder methods, so the chain can go on or be awaited there.
 */
function setup(rows: unknown[]) {
	const calls = new Map<string, unknown[]>();
	const chain: Record<string, (...args: unknown[]) => unknown> = {};
	for (const method of [
		"select",
		"from",
		"where",
		"orderBy",
		"limit",
		"update",
		"set",
		"returning",
		"insert",
		"values",
		"execute",
	]) {
		chain[method] = (...args: unknown[]) => {
			calls.set(method, args);
			return Object.assign(Promise.resolve(rows), chain);
		};
	}
	// The transaction runs its callback on the same stub.
	const transaction = async (
		callback: (tx: Database) => Promise<DeviceSessionRow | null>,
	) => callback(db);
	// SAFETY: `Object.create` yields `any`; the stub answers every builder
	// call the repository methods under test make.
	const db = Object.assign(Object.create(null), chain, {
		transaction,
	}) as Database;
	return { calls, repository: new DeviceSessionsRepository(db) };
}

describe("DeviceSessionsRepository", () => {
	it("bills a row only while billed_at is null, and reports a repeat as false", async () => {
		const first = setup([{ id: "row-1" }]);
		const repeat = setup([]);

		expect(await first.repository.markBilled("row-1", 3, new Date())).toBe(
			true,
		);
		expect(await repeat.repository.markBilled("row-1", 3, new Date())).toBe(
			false,
		);
		const where = compile(first.calls.get("where")?.[0]);
		expect(where.sql).toBe(
			'("device_sessions"."id" = $1 and "device_sessions"."billed_at" is null)',
		);
		expect(first.calls.get("set")?.[0]).toMatchObject({ minutes: 3 });
	});

	it("lists unbilled rows that ended or passed the stale time, oldest first", async () => {
		const { calls, repository } = setup([]);
		const staleBefore = new Date("2026-09-26T10:00:00.000Z");

		await repository.listUnbilled(staleBefore, 50);

		const where = compile(calls.get("where")?.[0]);
		expect(where.sql).toBe(
			'("device_sessions"."billed_at" is null and ("device_sessions"."ended_at" IS NOT NULL or "device_sessions"."started_at" < $1))',
		);
		expect(where.params).toEqual([staleBefore.toISOString()]);
		expect(calls.get("limit")).toEqual([50]);
	});

	it.each([
		{ inserted: false, usedMinutes: 60 },
		{ inserted: true, usedMinutes: 59 },
	])("inserts under the payer lock only while minutes are left ($usedMinutes of 60 used)", async ({
		inserted,
		usedMinutes,
	}) => {
		const { calls, repository } = setup([{ minutes: usedMinutes }]);

		const row = await repository.insertOpenWithinAllowance(
			{
				id: "row-1",
				organizationId: null,
				payerUserId: "owner-1",
				platform: "ios",
				projectId: "project-1",
				userId: "member-1",
			},
			userOwner("owner-1"),
			60,
			new Date("2026-09-01T00:00:00.000Z"),
		);

		expect(row !== null).toBe(inserted);
		expect(calls.has("insert")).toBe(inserted);
		// The lock is the payer's, so two members of one pool wait on one key.
		expect(compile(calls.get("execute")?.[0]).params).toEqual([
			"device-minutes:owner-1",
		]);
	});

	it("sums a personal payer over its own rows and the rows that name it as payer, and an org over the org rows", async () => {
		const personal = setup([{ minutes: 12 }]);
		const org = setup([{ minutes: 40 }]);
		const since = new Date("2026-09-01T00:00:00.000Z");

		expect(
			await personal.repository.usedMinutesSince(
				userOwner("user-1"),
				since,
				new Date(),
			),
		).toBe(12);
		expect(
			await org.repository.usedMinutesSince(
				orgOwner("org-1"),
				since,
				new Date(),
			),
		).toBe(40);
		// A member's minutes in another user's personal workspace count for
		// the owner (payer_user_id), never for the member's own allowance.
		expect(compile(personal.calls.get("where")?.[0]).sql).toBe(
			'("device_sessions"."started_at" >= $1 and ("device_sessions"."organization_id" is null and (("device_sessions"."user_id" = $2 and "device_sessions"."payer_user_id" is null) or "device_sessions"."payer_user_id" = $3)))',
		);
		expect(compile(org.calls.get("where")?.[0]).sql).toBe(
			'("device_sessions"."started_at" >= $1 and "device_sessions"."organization_id" = $2)',
		);
	});
});
