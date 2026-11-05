import { PgDialect, type SQL } from "@wandit/db";
import { desktopApps, desktopBuilds } from "@wandit/db/schema/desktop-apps";
import type { projects } from "@wandit/db/schema/projects";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type DesktopBuildRow,
	DesktopBuildsRepository,
	type InsertDesktopBuildResult,
	type NewDesktopBuild,
} from "./desktop-builds.repository";

function compile(query: SQL | undefined) {
	if (!query) {
		throw new Error("The repository passed no SQL to the fake");
	}
	const rendered = new PgDialect().sqlToQuery(query);
	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

const PROJECT_ID = "0f3a9c1b-4e7d-4a2b-9c3d-1e2f3a4b5c6d";
const REQUEST_KEY = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const CREATED_AT = new Date("2026-11-04T10:00:00.000Z");

const NEW_BUILD: NewDesktopBuild = {
	commitSha: "a".repeat(40),
	id: "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f",
	notes: null,
	organizationId: null,
	platform: "windows",
	projectId: PROJECT_ID,
	requestKey: REQUEST_KEY,
	userId: "user-1",
};

const ROW: DesktopBuildRow = {
	...NEW_BUILD,
	ciRunId: null,
	completedAt: null,
	createdAt: CREATED_AT,
	errorCode: null,
	errorMessage: null,
	findings: [],
	installerBytes: null,
	installerKey: null,
	installerSha256: null,
	productName: "Stock",
	releasedAt: null,
	releaseNumber: 2,
	status: "queued",
	triggerRunId: null,
	updateArchiveKey: null,
	updatedAt: CREATED_AT,
	updaterSignature: null,
	version: "1.0.2",
};

// Drizzle wraps the driver error, so the 23505 sits in the cause.
const UNIQUE_VIOLATION = new Error("insert failed", {
	cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
});

// Each `transaction` call answers the next outcome: the insert result or a
// thrown error. The select chain is the request key lookup.
function fakeDb(
	outcomes: (InsertDesktopBuildResult | Error)[],
	requestKeyRow: DesktopBuildRow | null,
) {
	const transaction = vi.fn(async () => {
		const outcome = outcomes.shift();
		if (outcome === undefined || outcome instanceof Error) {
			throw outcome ?? new Error("No transaction outcome left");
		}
		return outcome;
	});
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// `transaction` call and the select chain that `insertQueued` uses.
	const db = Object.assign(Object.create(null), {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => (requestKeyRow === null ? [] : [requestKeyRow]),
				}),
			}),
		}),
		transaction,
	}) as Database;
	return { repository: new DesktopBuildsRepository(db), transaction };
}

describe("DesktopBuildsRepository.insertQueued", () => {
	// A replay answered as "active" would refund the hold that the first
	// request still uses. A lost release number race must not refuse a build.
	it.each([
		{
			expected: { kind: "request_exists", row: { ...ROW, status: "building" } },
			name: "answers the row of a retried request key at once",
			outcomes: [UNIQUE_VIOLATION],
			requestKeyRow: { ...ROW, status: "building" as const },
			transactions: 1,
		},
		{
			expected: { kind: "created", row: ROW },
			name: "retries once after a release number conflict",
			outcomes: [UNIQUE_VIOLATION, { kind: "created" as const, row: ROW }],
			requestKeyRow: null,
			transactions: 2,
		},
		{
			expected: { kind: "live_exists" },
			name: "answers live_exists when the live index refuses twice",
			outcomes: [UNIQUE_VIOLATION, UNIQUE_VIOLATION],
			requestKeyRow: null,
			transactions: 2,
		},
	])("$name", async ({ expected, outcomes, requestKeyRow, transactions }) => {
		const { repository, transaction } = fakeDb([...outcomes], requestKeyRow);

		await expect(repository.insertQueued(NEW_BUILD, null)).resolves.toEqual(
			expected,
		);
		expect(transaction).toHaveBeenCalledTimes(transactions);
	});
});

// A transaction fake for the payer lock, the request key read, and the payer
// count of `insertQueuedOnce`. The tests stop before the insert.
function payerLockDb(input: {
	existing: DesktopBuildRow | null;
	liveTotal: number;
}) {
	const lockParams: ReturnType<typeof compile>["params"][] = [];
	const countParams: ReturnType<typeof compile>["params"][] = [];
	const tx = {
		execute: async (query: SQL) => {
			lockParams.push(compile(query).params);
		},
		select: () => ({
			from: () => ({
				innerJoin: () => ({
					where: async (where: SQL | undefined) => {
						countParams.push(compile(where).params);
						return [{ total: input.liveTotal }];
					},
				}),
				where: () => ({
					limit: async () => (input.existing === null ? [] : [input.existing]),
				}),
			}),
		}),
	};
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// `transaction` call that `insertQueued` uses.
	const db = Object.assign(Object.create(null), {
		transaction: async (
			callback: (client: typeof tx) => Promise<InsertDesktopBuildResult>,
		) => callback(tx),
	}) as Database;
	return {
		countParams,
		lockParams,
		repository: new DesktopBuildsRepository(db),
	};
}

describe("DesktopBuildsRepository.insertQueued payer limit", () => {
	// A wrong payer key gives each org member a cap of their own, and a
	// count without the lock lets two parallel creates both pass (audit A6).
	it.each([
		{
			build: NEW_BUILD,
			lock: "desktop-builds:user-1",
			name: "a personal payer",
			payer: "user-1",
		},
		{
			build: { ...NEW_BUILD, organizationId: "org-1" },
			lock: "desktop-builds:org:org-1",
			name: "an org payer",
			payer: "org-1",
		},
	])("refuses a third live build of $name under the payer lock", async ({
		build,
		lock,
		payer,
	}) => {
		const { countParams, lockParams, repository } = payerLockDb({
			existing: null,
			liveTotal: 2,
		});

		await expect(repository.insertQueued(build, null)).resolves.toEqual({
			kind: "payer_limit",
		});
		expect(lockParams).toEqual([[lock]]);
		expect(countParams.map((params) => params[0])).toEqual([payer]);
	});

	// A retry of one click shares the hold of its first row. A `payer_limit`
	// answer would make the service refund that shared hold.
	it("answers the row of a retried request key before the payer count", async () => {
		const existing: DesktopBuildRow = { ...ROW, status: "building" };
		const { countParams, repository } = payerLockDb({
			existing,
			liveTotal: 2,
		});

		await expect(repository.insertQueued(NEW_BUILD, null)).resolves.toEqual({
			kind: "request_exists",
			row: existing,
		});
		expect(countParams).toEqual([]);
	});
});

describe("DesktopBuildsRepository.transition", () => {
	function updateDb() {
		const updateWhere = vi.fn((_where: SQL | undefined) => ({
			returning: async () => [],
		}));
		// SAFETY: `Object.create` yields `any`; the stub exposes only the
		// update chain that `transition` uses for a status other than `ready`.
		const db = Object.assign(Object.create(null), {
			update: () => ({ set: () => ({ where: updateWhere }) }),
		}) as Database;
		return { repository: new DesktopBuildsRepository(db), updateWhere };
	}

	// A user cancel in `signing` refunds a build whose CI is done, and the
	// task still uploads the signed installer (audit A1). A row that a
	// crashed run left in `signing` must stay cancelable.
	it("lets a user cancel stop `signing` only after the task is surely gone", async () => {
		const { repository, updateWhere } = updateDb();

		await repository.transition(ROW.id, { by: "user", to: "canceled" });

		const predicate = compile(updateWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("desktop_builds"."id" = $1 and ("desktop_builds"."status" in ($2, $3, $4) or ("desktop_builds"."status" = $5 and "desktop_builds"."updated_at" < $6)))',
		);
		expect(predicate.params.slice(0, 5)).toEqual([
			ROW.id,
			"queued",
			"preparing",
			"building",
			"signing",
		]);
		// The task has a maxDuration of 80 min of compute, and signing does not wait.
		expect(Date.parse(String(predicate.params[5]))).toBeLessThan(
			Date.now() - 80 * 60_000,
		);
	});

	// A suspend or a delete during signing must still cancel the build.
	it("lets the task stop every live status", async () => {
		const { repository, updateWhere } = updateDb();

		await repository.transition(ROW.id, { by: "task", to: "canceled" });

		expect(compile(updateWhere.mock.calls[0]?.[0]).params).toEqual([
			ROW.id,
			"queued",
			"preparing",
			"building",
			"signing",
		]);
	});
});

describe("DesktopBuildsRepository.release", () => {
	// A read on the pool inside the transaction waits for a second connection.
	// Ten parallel releases then hold all ten connections for good (audit A2).
	it("reads the current release number and the project on its transaction", async () => {
		const stop = new Error("stop after the reads");
		const tx = {
			select: () => ({
				from: (
					table: typeof desktopApps | typeof desktopBuilds | typeof projects,
				) => ({
					where: () => {
						if (table === desktopApps) {
							return { for: async () => [{ currentBuildId: ROW.id }] };
						}
						if (table === desktopBuilds) {
							return Promise.resolve([{ releaseNumber: 3 }]);
						}
						// No row: staff suspended the project.
						return { limit: async () => [] };
					},
				}),
			}),
		};
		// SAFETY: `Object.create` yields `any`; the stub exposes the pool select,
		// which must stay unused, and the `transaction` call of `release`.
		const db = Object.assign(Object.create(null), {
			select: () => {
				throw new Error("The release read the pool, not its transaction");
			},
			transaction: async (
				callback: (client: typeof tx) => Promise<DesktopBuildRow>,
			) => callback(tx),
		}) as Database;
		const seen: { currentReleaseNumber: number | null; isActive: boolean }[] =
			[];

		await expect(
			new DesktopBuildsRepository(db).release(
				PROJECT_ID,
				ROW.id,
				"windows",
				async (state) => {
					seen.push({
						currentReleaseNumber: state.currentReleaseNumber,
						isActive: await state.isProjectActive(),
					});
					throw stop;
				},
			),
		).rejects.toBe(stop);
		expect(seen).toEqual([{ currentReleaseNumber: 3, isActive: false }]);
	});
});
