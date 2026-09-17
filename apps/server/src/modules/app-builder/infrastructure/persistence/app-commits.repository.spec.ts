import { PgDialect } from "@wandit/db";
import { appBranches, appCommits } from "@wandit/db/schema/app-versions";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	AppCommitsRepository,
	MalformedVersionCursorError,
	type NewAppCommit,
	VersionConflictError,
} from "./app-commits.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: unknown) {
	// SAFETY: sqlToQuery accepts the drizzle query objects a spec captures.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

// The spec provides exactly the methods the repository under test calls.
function fakeDb(stubs: Partial<Database>): Database {
	// SAFETY: the spec supplies each called method with a vi.fn fake.
	return stubs as Database;
}

const COMMIT: NewAppCommit = {
	chatId: "chat-1",
	message: "Add the hero section",
	messageId: "msg-1",
	numstat: [{ deletions: 1, insertions: 4, path: "src/routes/index.tsx" }],
	organizationId: null,
	parentSha: null,
	patchKey: "git/p/patches/aaa.diff",
	projectId: "00000000-0000-0000-0000-0000000000aa",
	restoredFromSha: null,
	sha: "a".repeat(40),
	source: "agent",
	turnId: "turn-1",
	userId: "user-1",
};

// A `select().from().where().orderBy?().limit()` chain ending in `rows`.
function selectCapture(rows: unknown[]) {
	const limit = vi.fn().mockImplementation(async () => rows);
	const orderBy = vi.fn().mockImplementation(() => ({ limit }));
	const where = vi.fn().mockImplementation(() => ({ limit, orderBy }));
	const from = vi.fn().mockImplementation(() => ({ where }));
	const select = vi.fn().mockImplementation(() => ({ from }));

	return { from, limit, orderBy, select, where };
}

// An `insert().values().onConflictDoNothing().returning()` chain.
function insertCapture(inserted: unknown[]) {
	const returning = vi.fn().mockImplementation(async () => inserted);
	const onConflictDoNothing = vi.fn().mockImplementation(() => ({ returning }));
	const values = vi.fn().mockImplementation(() => ({ onConflictDoNothing }));
	const insert = vi.fn().mockImplementation(() => ({ values }));
	return { insert, onConflictDoNothing, returning, values };
}

// An `update().set().where().returning()` chain.
function updateCapture(updated: { id: string }[]) {
	const returning = vi.fn().mockImplementation(async () => updated);
	const where = vi.fn().mockImplementation(() => ({ returning }));
	const set = vi.fn().mockImplementation(() => ({ where }));
	const update = vi.fn().mockImplementation(() => ({ set }));
	return { returning, set, update, where };
}

describe("AppCommitsRepository.insert", () => {
	it("inserts the row and tolerates the (projectId, sha) unique index", async () => {
		const insert = insertCapture([{ id: "row-1", ...COMMIT }]);
		const repository = new AppCommitsRepository(
			fakeDb({ insert: insert.insert }),
		);

		const row = await repository.insert(COMMIT);

		expect(insert.insert).toHaveBeenCalledWith(appCommits);
		expect(insert.values).toHaveBeenCalledWith(COMMIT);
		// SAFETY: the repository passes { target } as the conflict config.
		const conflict = insert.onConflictDoNothing.mock.calls[0]?.[0] as {
			target: unknown[];
		};
		expect(conflict.target).toEqual([appCommits.projectId, appCommits.sha]);
		expect(row.id).toBe("row-1");
	});

	it("returns the existing row when the unique index wins", async () => {
		const insert = insertCapture([]);
		const existing = { id: "row-9", sha: COMMIT.sha };
		const select = selectCapture([existing]);
		const repository = new AppCommitsRepository(
			fakeDb({ insert: insert.insert, select: select.select }),
		);

		const row = await repository.insert(COMMIT);

		expect(row).toEqual(existing);
	});
});

describe("AppCommitsRepository.listByProject", () => {
	it("pages newest-first inside the project with a cursor predicate", async () => {
		const select = selectCapture([]);
		const repository = new AppCommitsRepository(
			fakeDb({ select: select.select }),
		);

		await repository.listByProject("p-1", {
			cursor: "2026-09-14T10:00:00.000Z_row-5",
			limit: 50,
		});

		const predicate = compile(select.where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_commits"."project_id" = $1');
		expect(predicate.sql).toContain('"app_commits"."created_at" < $2');
		expect(predicate.sql).toContain('"app_commits"."created_at" = $3');
		expect(predicate.sql).toContain('"app_commits"."id" < $4');
		expect(predicate.params).toEqual([
			"p-1",
			"2026-09-14T10:00:00.000Z",
			"2026-09-14T10:00:00.000Z",
			"row-5",
		]);
		expect(select.limit).toHaveBeenCalledWith(51);
	});

	it("clamps the limit at 50 and answers the next cursor", async () => {
		const row = {
			createdAt: new Date("2026-09-14T10:00:00.000Z"),
			id: "row-1",
		};
		// 51 rows for limit 50: the extra row proves a next page exists.
		const rows = Array.from({ length: 51 }, () => ({ ...row }));
		const select = selectCapture(rows);
		const repository = new AppCommitsRepository(
			fakeDb({ select: select.select }),
		);

		const page = await repository.listByProject("p-1", { limit: 100 });

		expect(page.items).toHaveLength(50);
		expect(page.nextCursor).toBe("2026-09-14T10:00:00.000Z_row-1");
	});

	it("answers a null cursor on the last page", async () => {
		const select = selectCapture([{ createdAt: new Date(), id: "row-1" }]);
		const repository = new AppCommitsRepository(
			fakeDb({ select: select.select }),
		);

		const page = await repository.listByProject("p-1", { limit: 50 });

		expect(page.nextCursor).toBeNull();
	});

	it("rejects a malformed cursor with a typed error", async () => {
		const repository = new AppCommitsRepository(fakeDb({}));

		await expect(
			repository.listByProject("p-1", { cursor: "not-a-cursor", limit: 50 }),
		).rejects.toBeInstanceOf(MalformedVersionCursorError);
	});
});

describe("AppCommitsRepository.findBySha", () => {
	it("scopes the lookup to project and sha", async () => {
		const select = selectCapture([]);
		const repository = new AppCommitsRepository(
			fakeDb({ select: select.select }),
		);

		await repository.findBySha("p-1", "abc");

		const predicate = compile(select.where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["p-1", "abc"]);
	});
});

describe("AppCommitsRepository.upsertBranchHead", () => {
	it("updates only when the stored head matches the expected sha or is already applied", async () => {
		const update = updateCapture([{ id: "b-1" }]);
		const repository = new AppCommitsRepository(
			fakeDb({ update: update.update }),
		);

		const ok = await repository.upsertBranchHead("p-1", "main", {
			expectedHeadSha: "a".repeat(40),
			headSha: "b".repeat(40),
			organizationId: null,
			userId: "user-1",
		});

		expect(ok).toBe(true);
		expect(update.update).toHaveBeenCalledWith(appBranches);
		expect(update.set).toHaveBeenCalledWith({ headSha: "b".repeat(40) });
		const predicate = compile(update.where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"app_branches"."project_id" = $1');
		expect(predicate.sql).toContain('"app_branches"."name" = $2');
		expect(predicate.sql).toContain("IS NOT DISTINCT FROM");
		expect(predicate.params).toEqual([
			"p-1",
			"main",
			"a".repeat(40),
			"b".repeat(40),
		]);
	});

	it("answers false on a head mismatch with a non-null expected sha", async () => {
		const update = updateCapture([]);
		// The row with the other head wins the unique (projectId, name) index.
		const insert = insertCapture([]);
		const repository = new AppCommitsRepository(
			fakeDb({ insert: insert.insert, update: update.update }),
		);

		const ok = await repository.upsertBranchHead("p-1", "main", {
			expectedHeadSha: "a".repeat(40),
			headSha: "b".repeat(40),
			organizationId: null,
			userId: "user-1",
		});

		expect(ok).toBe(false);
		expect(insert.onConflictDoNothing).toHaveBeenCalledOnce();
	});

	it("inserts the main row when the expected head is non-null and no row exists", async () => {
		const update = updateCapture([]);
		const insert = insertCapture([{ id: "b-1" }]);
		const repository = new AppCommitsRepository(
			fakeDb({ insert: insert.insert, update: update.update }),
		);

		// The template init sha is the parent; no row exists for it.
		const ok = await repository.upsertBranchHead("p-1", "main", {
			expectedHeadSha: "a".repeat(40),
			headSha: "b".repeat(40),
			organizationId: null,
			userId: "user-1",
		});

		expect(ok).toBe(true);
		expect(insert.values).toHaveBeenCalledWith({
			headSha: "b".repeat(40),
			name: "main",
			organizationId: null,
			projectId: "p-1",
			userId: "user-1",
		});
	});

	it("inserts the main row when the expected head is null and no row exists", async () => {
		const update = updateCapture([]);
		const insert = insertCapture([{ id: "b-1" }]);
		const repository = new AppCommitsRepository(
			fakeDb({ insert: insert.insert, update: update.update }),
		);

		const ok = await repository.upsertBranchHead("p-1", "main", {
			expectedHeadSha: null,
			headSha: "a".repeat(40),
			organizationId: "org-1",
			userId: "user-1",
		});

		expect(ok).toBe(true);
		expect(insert.values).toHaveBeenCalledWith({
			headSha: "a".repeat(40),
			name: "main",
			organizationId: "org-1",
			projectId: "p-1",
			userId: "user-1",
		});
		// SAFETY: the repository passes { target } as the conflict config.
		const conflict = insert.onConflictDoNothing.mock.calls[0]?.[0] as {
			target: unknown[];
		};
		expect(conflict.target).toEqual([appBranches.projectId, appBranches.name]);
	});

	it("answers false when a concurrent insert wins the main row", async () => {
		const update = updateCapture([]);
		const insert = insertCapture([]);
		const repository = new AppCommitsRepository(
			fakeDb({ insert: insert.insert, update: update.update }),
		);

		const ok = await repository.upsertBranchHead("p-1", "main", {
			expectedHeadSha: null,
			headSha: "a".repeat(40),
			organizationId: null,
			userId: "user-1",
		});

		expect(ok).toBe(false);
	});
});

describe("AppCommitsRepository.findScopedProject", () => {
	it("scopes the project read to the caller and filters deleted rows", async () => {
		const select = selectCapture([]);
		const repository = new AppCommitsRepository(
			fakeDb({ select: select.select }),
		);

		await repository.findScopedProject(
			{ kind: "personal", userId: "user-1" },
			"p-1",
		);

		const predicate = compile(select.where.mock.calls[0]?.[0]);
		expect(predicate.sql).toContain('"projects"."user_id" = $1');
		expect(predicate.sql).toContain('"projects"."organization_id" is null');
		expect(predicate.sql).toContain('"projects"."id" = $2');
		expect(predicate.sql).toContain('"projects"."deleted_at" is null');
	});

	it("scopes an org workspace to its organization id", async () => {
		const select = selectCapture([]);
		const repository = new AppCommitsRepository(
			fakeDb({ select: select.select }),
		);

		await repository.findScopedProject(
			{
				actorIsLimitExempt: false,
				kind: "org",
				organizationId: "org-1",
				userId: "user-1",
			},
			"p-1",
		);

		const predicate = compile(select.where.mock.calls[0]?.[0]);
		expect(predicate.params[0]).toBe("org-1");
	});
});

describe("VersionConflictError", () => {
	it("names the error for instanceof checks in the service", () => {
		expect(new VersionConflictError().name).toBe("VersionConflictError");
	});
});
