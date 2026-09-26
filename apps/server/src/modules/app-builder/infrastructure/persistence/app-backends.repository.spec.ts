import { PgDialect, QueryBuilder, type SQL } from "@wandit/db";
import { appBackends } from "@wandit/db/schema/app-backends";
import type { projects } from "@wandit/db/schema/projects";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { assertBackendEntitlement } from "../../domain/backend-lifecycle";
import {
	type AppBackendRow,
	AppBackendsRepository,
} from "./app-backends.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SQL | undefined) {
	// SAFETY: the where-mock receives real drizzle SQL chunks.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

const ROW: AppBackendRow = {
	anonKey: null,
	dbHost: null,
	failureCode: null,
	id: "backend-1",
	orgId: null,
	organizationId: "org-1",
	projectId: "project-1",
	ref: null,
	region: "eu-west-3",
	requestKey: "req-key-1",
	status: "creating",
	triggerRunId: null,
	userId: "user-1",
};

function setupSelect(rows: AppBackendRow[] = []) {
	const limit = vi.fn(async (_count: number) => rows);
	const where = vi.fn((_predicate: SQL | undefined) => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// select chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { select }) as Database;
	const repository = new AppBackendsRepository(db);

	return { repository, where };
}

function setupUpdate() {
	const where = vi.fn(async (_predicate: SQL | undefined) => []);
	const set = vi.fn((_input: Partial<typeof appBackends.$inferInsert>) => ({
		where,
	}));
	const update = vi.fn(() => ({ set }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// update chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { update }) as Database;
	const repository = new AppBackendsRepository(db);

	return { repository, set, where };
}

describe("AppBackendsRepository.findByProjectId", () => {
	it("selects the row columns scoped to the project id", async () => {
		const { repository, where } = setupSelect([ROW]);

		const result = await repository.findByProjectId("project-1");

		expect(result).toEqual(ROW);
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1"]);
		expect(predicate.sql).toContain('"app_backends"."project_id" = $1');
	});

	it("returns null when the project has no row", async () => {
		const { repository } = setupSelect([]);

		expect(await repository.findByProjectId("missing")).toBeNull();
	});
});

describe("AppBackendsRepository.insertCreatingWithinLimit", () => {
	const INPUT = {
		organizationId: "org-1",
		projectId: "project-1",
		region: "eu-west-3",
		requestKey: "req-key-1",
		userId: "user-1",
	};
	const ORG_OWNER = { organizationId: "org-1", type: "org" as const };

	// A transaction stub: `execute` takes the lock, the first select reads
	// the project row, the second counts, and the insert returns `inserted`.
	function setupTransaction(options: {
		existing: AppBackendRow[];
		owned: number;
		inserted: AppBackendRow[];
	}) {
		const order: string[] = [];
		const execute = vi.fn(async (_query: SQL) => {
			order.push("lock");
		});
		const limit = vi.fn(async (_count: number) => {
			order.push("project-row");
			return options.existing;
		});
		const countWhere = vi.fn(async (_predicate: SQL | undefined) => {
			order.push("count");
			return [{ total: options.owned }];
		});
		const projectRowSelect = { from: () => ({ where: () => ({ limit }) }) };
		const countSelect = {
			from: () => ({ innerJoin: () => ({ where: countWhere }) }),
		};
		const select = vi
			.fn<() => typeof projectRowSelect | typeof countSelect>()
			.mockReturnValueOnce(projectRowSelect)
			.mockReturnValueOnce(countSelect);
		const values = vi.fn((_input: typeof appBackends.$inferInsert) => ({
			returning: async () => {
				order.push("insert");
				return options.inserted;
			},
		}));
		const tx = { execute, insert: () => ({ values }), select };
		const transaction = vi.fn(
			async <T>(work: (client: typeof tx) => Promise<T>): Promise<T> =>
				work(tx),
		);
		// SAFETY: `Object.create` yields `any`; the stub exposes only the
		// transaction the repository method under test calls.
		const db = Object.assign(Object.create(null), {
			transaction,
		}) as Database;
		return {
			execute,
			order,
			repository: new AppBackendsRepository(db),
			values,
		};
	}

	it("locks the payer, counts, and inserts under the plan limit", async () => {
		const { execute, order, repository, values } = setupTransaction({
			existing: [],
			inserted: [ROW],
			owned: 2,
		});

		const outcome = await repository.insertCreatingWithinLimit(
			INPUT,
			ORG_OWNER,
			(owned) => assertBackendEntitlement("business", owned),
		);

		expect(outcome).toEqual({ kind: "inserted", row: ROW });
		expect(order).toEqual(["lock", "project-row", "count", "insert"]);
		const lock = compile(execute.mock.calls[0]?.[0]);
		expect(lock.sql).toBe("select pg_advisory_xact_lock(hashtext($1))");
		expect(lock.params).toEqual(["app-backends:org:org-1"]);
		expect(values).toHaveBeenCalledWith({ ...INPUT, status: "creating" });
	});

	it("refuses at the plan limit and inserts nothing", async () => {
		const { order, repository, values } = setupTransaction({
			existing: [],
			inserted: [ROW],
			owned: 1,
		});

		const outcome = await repository.insertCreatingWithinLimit(
			INPUT,
			ORG_OWNER,
			(owned) => assertBackendEntitlement("pro", owned),
		);

		expect(outcome).toEqual({
			kind: "refused",
			refusal: {
				allowed: false,
				code: "backend_limit_reached",
				limit: 1,
				plan: "pro",
			},
		});
		expect(order).toEqual(["lock", "project-row", "count"]);
		expect(values).not.toHaveBeenCalled();
	});

	it("answers the existing row of the project without a count", async () => {
		const existing = { ...ROW, status: "active" as const };
		const { order, repository } = setupTransaction({
			existing: [existing],
			inserted: [],
			owned: 5,
		});

		const outcome = await repository.insertCreatingWithinLimit(
			INPUT,
			ORG_OWNER,
			(owned) => assertBackendEntitlement("pro", owned),
		);

		expect(outcome).toEqual({ kind: "exists", row: existing });
		expect(order).toEqual(["lock", "project-row"]);
	});
});

describe("AppBackendsRepository.markActive", () => {
	it("sets status active with the anon key, the host, and the stamp", async () => {
		const { repository, set, where } = setupCasUpdate([{ id: "backend-1" }]);
		const lastActiveAt = new Date("2026-09-17T12:00:00Z");

		await expect(
			repository.markActive("project-1", {
				anonKey: "anon-key-1",
				dbHost: "db.ref.supabase.co",
				lastActiveAt,
			}),
		).resolves.toBe(true);

		expect(set).toHaveBeenCalledWith({
			anonKey: "anon-key-1",
			dbHost: "db.ref.supabase.co",
			error: null,
			failureCode: null,
			failureKind: null,
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: null,
			lastActiveAt,
			sentryEventId: null,
			status: "active",
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1", "deleting"]);
		expect(predicate.sql).toContain('"app_backends"."project_id" = $1');
		expect(predicate.sql).toContain('"app_backends"."status" <> $2');
	});

	it("answers false and keeps a deleting row", async () => {
		const { repository } = setupCasUpdate([]);

		await expect(
			repository.markActive("project-1", {
				anonKey: "anon-key-1",
				dbHost: "db.ref.supabase.co",
				lastActiveAt: new Date(),
			}),
		).resolves.toBe(false);
	});
});

describe("AppBackendsRepository.markRestoring", () => {
	it("sets restoring only where the row is paused and answers true", async () => {
		const { repository, set, where } = setupCasUpdate([{ id: "backend-1" }]);

		await expect(repository.markRestoring("project-1")).resolves.toBe(true);

		expect(set).toHaveBeenCalledWith({ status: "restoring" });
		const compiled = compile(where.mock.calls[0]?.[0]);
		expect(compiled.sql).toContain('"project_id" = $1');
		expect(compiled.sql).toContain('"status" = $2');
		expect(compiled.params).toEqual(["project-1", "paused"]);
	});

	it("answers false when no paused row matched", async () => {
		const { repository } = setupCasUpdate([]);

		await expect(repository.markRestoring("project-1")).resolves.toBe(false);
	});
});

describe("AppBackendsRepository.markError", () => {
	it("writes the failure code and the failure columns", async () => {
		const { repository, set, where } = setupUpdate();

		await repository.markError("project-1", {
			error: "poll timed out",
			failureCode: "backend_provision_timeout",
			failureKind: "timeout",
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: "supabase_api",
			sentryEventId: "evt-1",
		});

		expect(set).toHaveBeenCalledWith({
			error: "poll timed out",
			failureCode: "backend_provision_timeout",
			failureKind: "timeout",
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: "supabase_api",
			sentryEventId: "evt-1",
			status: "error",
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1", "deleting"]);
		expect(predicate.sql).toContain('"app_backends"."status" <> $2');
	});
});

function setupCasUpdate(returned: { id: string }[]) {
	const returning = vi.fn(async () => returned);
	const where = vi.fn((_predicate: SQL | undefined) => ({ returning }));
	const set = vi.fn((_input: Partial<typeof appBackends.$inferInsert>) => ({
		where,
	}));
	const update = vi.fn(() => ({ set }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// update chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { update }) as Database;
	return { repository: new AppBackendsRepository(db), set, where };
}

describe("AppBackendsRepository.touchActive", () => {
	it("stamps lastActiveAt only on an active row", async () => {
		const { repository, set, where } = setupUpdate();

		await repository.touchActive("project-1");

		expect(set).toHaveBeenCalledWith({ lastActiveAt: expect.any(Date) });
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1", "active"]);
		expect(predicate.sql).toContain('"app_backends"."status" = $2');
	});
});

describe("AppBackendsRepository.markPaused", () => {
	it("moves an active row to paused and stamps pausedAt", async () => {
		const { repository, set, where } = setupCasUpdate([{ id: "backend-1" }]);

		await expect(repository.markPaused("project-1")).resolves.toBe(true);

		expect(set).toHaveBeenCalledWith({
			pausedAt: expect.any(Date),
			status: "paused",
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_backends"."status" = $2');
		expect(predicate.params).toEqual(["project-1", "active"]);
	});

	it("answers false when the row left active", async () => {
		const { repository } = setupCasUpdate([]);

		await expect(repository.markPaused("project-1")).resolves.toBe(false);
	});
});

describe("AppBackendsRepository.markRestored", () => {
	it("moves a restoring row to active, clears pausedAt, and stamps activity", async () => {
		const { repository, set, where } = setupCasUpdate([{ id: "backend-1" }]);

		await expect(repository.markRestored("project-1")).resolves.toBe(true);

		expect(set).toHaveBeenCalledWith({
			lastActiveAt: expect.any(Date),
			pausedAt: null,
			status: "active",
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_backends"."status" = $2');
		expect(predicate.params).toEqual(["project-1", "restoring"]);
	});

	it("answers false when the row left restoring", async () => {
		const { repository } = setupCasUpdate([]);

		await expect(repository.markRestored("project-1")).resolves.toBe(false);
	});
});

describe("AppBackendsRepository.markRestoreFailed", () => {
	it("moves a restoring row to error with backend_restore_failed", async () => {
		const { repository, set, where } = setupCasUpdate([{ id: "backend-1" }]);

		await expect(
			repository.markRestoreFailed("project-1", "RESTORE_FAILED"),
		).resolves.toBe(true);

		expect(set).toHaveBeenCalledWith({
			error: "Supabase reported RESTORE_FAILED during the restore",
			failureCode: "backend_restore_failed",
			failureKind: "provider",
			failureProvider: "supabase",
			failureProviderMessage: "RESTORE_FAILED",
			failureRequestId: null,
			failureSource: "supabase_api",
			sentryEventId: null,
			status: "error",
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_backends"."status" = $2');
		expect(predicate.params).toEqual(["project-1", "restoring"]);
	});
});

describe("AppBackendsRepository.markDeleting", () => {
	it("moves any other status to deleting and stamps deletingAt", async () => {
		const { repository, set, where } = setupCasUpdate([{ id: "backend-1" }]);

		await expect(repository.markDeleting("project-1")).resolves.toBe(true);

		expect(set).toHaveBeenCalledWith({
			deletingAt: expect.any(Date),
			status: "deleting",
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1", "deleting"]);
		expect(predicate.sql).toContain('"app_backends"."status" <> $2');
	});

	it("answers false and keeps the first stamp on a deleting row", async () => {
		const { repository } = setupCasUpdate([]);

		await expect(repository.markDeleting("project-1")).resolves.toBe(false);
	});
});

describe("AppBackendsRepository.markDeleted", () => {
	it("clears the ref of the deleting row that still holds it", async () => {
		const { repository, set, where } = setupCasUpdate([{ id: "backend-1" }]);

		await expect(
			repository.markDeleted("project-1", "abcdefghijklmnopqrst"),
		).resolves.toBe(true);

		expect(set).toHaveBeenCalledWith({ ref: null });
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_backends"."status" = $2');
		expect(predicate.sql).toContain('"app_backends"."ref" = $3');
		expect(predicate.params).toEqual([
			"project-1",
			"deleting",
			"abcdefghijklmnopqrst",
		]);
	});
});

describe("AppBackendsRepository.listLifecycleCandidates", () => {
	const CANDIDATE = {
		createdAt: new Date("2026-09-01T00:00:00Z"),
		deletingAt: null,
		id: "backend-1",
		lastActiveAt: null,
		organizationId: null,
		projectDeletedAt: null,
		projectId: "project-1",
		published: false,
		status: "active" as const,
	};

	function setupList(rows: (typeof CANDIDATE & { ref: string | null })[]) {
		const where = vi.fn(async (_predicate: SQL | undefined) => rows);
		const innerJoin = vi.fn(
			(_table: typeof projects, _on: SQL | undefined) => ({ where }),
		);
		const from = vi.fn(() => ({ innerJoin }));
		const select = vi.fn((_columns: { published: SQL }) => ({ from }));
		// SAFETY: `Object.create` yields `any`; the stub exposes only the
		// select chain the repository method under test calls.
		const db = Object.assign(Object.create(null), { select }) as Database;
		return {
			innerJoin,
			repository: new AppBackendsRepository(db),
			select,
			where,
		};
	}

	it("reads idle active, restoring, deleting, and deleted-project rows that hold a ref", async () => {
		const idleBefore = new Date("2026-09-18T03:00:00Z");
		const { innerJoin, repository, where } = setupList([
			{ ...CANDIDATE, ref: "abcdefghijklmnopqrst" },
		]);

		const rows = await repository.listLifecycleCandidates(idleBefore);

		expect(rows).toEqual([{ ...CANDIDATE, ref: "abcdefghijklmnopqrst" }]);
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_backends"."ref" IS NOT NULL');
		expect(predicate.sql).toContain(
			'coalesce("app_backends"."last_active_at", "app_backends"."created_at") < $2',
		);
		expect(predicate.sql).toContain('"projects"."deleted_at" IS NOT NULL');
		expect(predicate.params).toEqual([
			"active",
			idleBefore,
			"restoring",
			"deleting",
		]);
		const join = compile(innerJoin.mock.calls[0]?.[1]);
		expect(join.sql).toBe('"projects"."id" = "app_backends"."project_id"');
	});

	it("keeps the table names of the published subquery in a one-table select", async () => {
		const { repository, select } = setupList([]);

		await repository.listLifecycleCandidates(new Date());

		// A one-table select writes a bare top-level column without its table
		// name; the subquery must still compare the two project ids.
		const field = select.mock.calls[0]?.[0].published;
		if (field === undefined) {
			throw new Error("select was not called");
		}
		const rendered = new QueryBuilder()
			.select({ published: field })
			.from(appBackends)
			.toSQL();
		expect(rendered.sql).toContain(
			'"deployments"."project_id" = "app_backends"."project_id"',
		);
		expect(rendered.sql).toContain('"deployments"."status" = $1');
		expect(rendered.params).toEqual(["active"]);
	});

	it("drops a row without a ref", async () => {
		const { repository } = setupList([{ ...CANDIDATE, ref: null }]);

		expect(await repository.listLifecycleCandidates(new Date())).toEqual([]);
	});
});

describe("AppBackendsRepository.countActiveForOwner", () => {
	function setupCount(rows: { total: number }[]) {
		const where = vi.fn(async (_predicate: SQL | undefined) => rows);
		const innerJoin = vi.fn(
			(_table: typeof projects, _on: SQL | undefined) => ({
				where,
			}),
		);
		const from = vi.fn(() => ({ innerJoin }));
		const select = vi.fn(() => ({ from }));
		// SAFETY: `Object.create` yields `any`; the stub exposes only the
		// select chain the repository method under test calls.
		const db = Object.assign(Object.create(null), { select }) as Database;
		return { innerJoin, repository: new AppBackendsRepository(db), where };
	}

	it("counts the owned statuses of a personal owner on live projects", async () => {
		const { innerJoin, repository, where } = setupCount([{ total: 2 }]);

		expect(
			await repository.countActiveForOwner({ type: "user", userId: "user-1" }),
		).toBe(2);

		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_backends"."user_id" = $1');
		expect(predicate.sql).toContain('"app_backends"."organization_id" is null');
		expect(predicate.params).toEqual([
			"user-1",
			"creating",
			"active",
			"paused",
			"restoring",
		]);
		const join = compile(innerJoin.mock.calls[0]?.[1]);
		expect(join.sql).toContain('"projects"."deleted_at" is null');
	});

	it("counts the org rows only for an org owner", async () => {
		const { repository, where } = setupCount([{ total: 0 }]);

		expect(
			await repository.countActiveForOwner({
				organizationId: "org-1",
				type: "org",
			}),
		).toBe(0);

		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_backends"."organization_id" = $1');
		expect(predicate.sql).not.toContain('"app_backends"."user_id"');
		expect(predicate.params[0]).toBe("org-1");
	});
});
