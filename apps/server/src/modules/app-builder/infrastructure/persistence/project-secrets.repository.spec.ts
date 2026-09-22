import { PgDialect, type SQL } from "@wandit/db";
import { projectSecrets } from "@wandit/db/schema/project-secrets";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type ProjectSecretCipherRow,
	ProjectSecretsRepository,
	type ProjectSecretUpsertInput,
} from "./project-secrets.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SQL | undefined) {
	// SAFETY: the where-mock receives real drizzle SQL chunks.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

const UPSERT_INPUT: ProjectSecretUpsertInput = {
	ciphertext: "cipher-1",
	createdBy: "user-1",
	keyVersion: 2,
	kind: "user",
	name: "STRIPE_SECRET_KEY",
	organizationId: null,
	projectId: "project-1",
	userId: "user-1",
};

const CIPHER_ROW: ProjectSecretCipherRow = {
	ciphertext: "cipher-1",
	id: "row-1",
	keyVersion: 1,
	name: "STRIPE_SECRET_KEY",
	projectId: "project-1",
};

/** The argument of `onConflictDoUpdate` the upsert builds. */
type ConflictInput = {
	set: {
		ciphertext: string;
		keyVersion: number;
		kind: string;
		updatedAt: Date;
	};
	setWhere?: SQL;
	target: (typeof projectSecrets.projectId | typeof projectSecrets.name)[];
};

function setupInsert(returned: { id: string }[]) {
	const returning = vi.fn(async () => returned);
	const onConflictDoUpdate = vi.fn((_conflict: ConflictInput) => ({
		returning,
	}));
	const values = vi.fn(() => ({ onConflictDoUpdate }));
	const insert = vi.fn(() => ({ values }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// insert chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { insert }) as Database;

	return {
		onConflictDoUpdate,
		repository: new ProjectSecretsRepository(db),
		values,
	};
}

describe("ProjectSecretsRepository.upsert", () => {
	it("inserts the row and guards the conflict update to user rows for a user write", async () => {
		const { onConflictDoUpdate, repository, values } = setupInsert([
			{ id: "row-1" },
		]);

		const id = await repository.upsert(UPSERT_INPUT);

		expect(id).toBe("row-1");
		expect(values).toHaveBeenCalledWith({
			ciphertext: "cipher-1",
			createdBy: "user-1",
			keyVersion: 2,
			kind: "user",
			name: "STRIPE_SECRET_KEY",
			organizationId: null,
			projectId: "project-1",
			userId: "user-1",
		});
		const conflict = onConflictDoUpdate.mock.calls[0]?.[0];
		expect(conflict?.target).toEqual([
			projectSecrets.projectId,
			projectSecrets.name,
		]);
		expect(conflict?.set).toEqual({
			ciphertext: "cipher-1",
			keyVersion: 2,
			kind: "user",
			updatedAt: expect.any(Date),
		});
		const guard = compile(conflict?.setWhere);
		expect(guard.sql).toContain('"project_secrets"."kind" = $1');
		expect(guard.params).toEqual(["user"]);
	});

	it("answers null when the guarded update touched no row (a system row)", async () => {
		const { repository } = setupInsert([]);

		expect(await repository.upsert(UPSERT_INPUT)).toBeNull();
	});

	it("puts no guard on a system write", async () => {
		const { onConflictDoUpdate, repository } = setupInsert([{ id: "row-1" }]);

		await repository.upsert({
			...UPSERT_INPUT,
			createdBy: null,
			kind: "system",
		});

		expect(onConflictDoUpdate.mock.calls[0]?.[0]).not.toHaveProperty(
			"setWhere",
		);
	});
});

function setupDelete(deleted: { id: string }[], found: { kind: string }[]) {
	const returning = vi.fn(async () => deleted);
	const deleteWhere = vi.fn((_predicate: SQL | undefined) => ({ returning }));
	const del = vi.fn(() => ({ where: deleteWhere }));
	const limit = vi.fn(async (_count: number) => found);
	const selectWhere = vi.fn((_predicate: SQL | undefined) => ({ limit }));
	const from = vi.fn(() => ({ where: selectWhere }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// delete and select chains the repository method under test calls.
	const db = Object.assign(Object.create(null), {
		delete: del,
		select,
	}) as Database;

	return { deleteWhere, repository: new ProjectSecretsRepository(db), select };
}

describe("ProjectSecretsRepository.deleteUserSecret", () => {
	it("deletes only a user row of that project and name", async () => {
		const { deleteWhere, repository, select } = setupDelete(
			[{ id: "row-1" }],
			[],
		);

		const outcome = await repository.deleteUserSecret(
			"project-1",
			"STRIPE_SECRET_KEY",
		);

		expect(outcome).toEqual({ id: "row-1", outcome: "deleted" });
		const predicate = compile(deleteWhere.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual([
			"project-1",
			"STRIPE_SECRET_KEY",
			"user",
		]);
		expect(predicate.sql).toContain('"project_secrets"."kind" = $3');
		expect(select).not.toHaveBeenCalled();
	});

	it("answers system when the remaining row is a system row", async () => {
		const { repository } = setupDelete([], [{ kind: "system" }]);

		expect(
			await repository.deleteUserSecret("project-1", "STRIPE_SECRET_KEY"),
		).toEqual({ outcome: "system" });
	});

	it("answers missing when no row exists", async () => {
		const { repository } = setupDelete([], []);

		expect(
			await repository.deleteUserSecret("project-1", "STRIPE_SECRET_KEY"),
		).toEqual({ outcome: "missing" });
	});
});

function setupSelect<Row>(rows: Row[]) {
	const limit = vi.fn(async (_count: number) => rows);
	const orderBy = vi.fn(() => Object.assign(Promise.resolve(rows), { limit }));
	const where = vi.fn((_predicate: SQL | undefined) =>
		Object.assign(Promise.resolve(rows), { limit, orderBy }),
	);
	const from = vi.fn(() => ({ where }));
	// Drizzle columns carry their SQL name; the spec reads only the keys.
	const select = vi.fn((_columns: Record<string, { name: string }>) => ({
		from,
	}));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// select chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { select }) as Database;

	return { limit, repository: new ProjectSecretsRepository(db), select, where };
}

describe("ProjectSecretsRepository reads", () => {
	it("listSummaries selects the four summary columns, never the ciphertext", async () => {
		const row = {
			createdAt: new Date("2026-09-01T00:00:00.000Z"),
			kind: "user" as const,
			name: "STRIPE_SECRET_KEY",
			updatedAt: new Date("2026-09-02T00:00:00.000Z"),
		};
		const { repository, select, where } = setupSelect([row]);

		const result = await repository.listSummaries("project-1");

		expect(result).toEqual([row]);
		expect(Object.keys(select.mock.calls[0]?.[0] ?? {}).sort()).toEqual([
			"createdAt",
			"kind",
			"name",
			"updatedAt",
		]);
		expect(compile(where.mock.calls[0]?.[0]).params).toEqual(["project-1"]);
	});

	it("findCipherByName answers the row or null", async () => {
		const found = setupSelect([CIPHER_ROW]);
		const empty = setupSelect([]);

		expect(
			await found.repository.findCipherByName("project-1", "STRIPE_SECRET_KEY"),
		).toEqual(CIPHER_ROW);
		expect(compile(found.where.mock.calls[0]?.[0]).params).toEqual([
			"project-1",
			"STRIPE_SECRET_KEY",
		]);
		expect(
			await empty.repository.findCipherByName("project-1", "STRIPE_SECRET_KEY"),
		).toBeNull();
	});

	it("listBelowKeyVersion pages by id after the cursor", async () => {
		const { limit, repository, where } = setupSelect([CIPHER_ROW]);

		await repository.listBelowKeyVersion(2, null, 100);
		await repository.listBelowKeyVersion(2, "row-1", 100);

		const first = compile(where.mock.calls[0]?.[0]);
		expect(first.sql).toContain('"project_secrets"."key_version" < $1');
		expect(first.params).toEqual([2]);
		const second = compile(where.mock.calls[1]?.[0]);
		expect(second.sql).toContain('"project_secrets"."id" > $2');
		expect(second.params).toEqual([2, "row-1"]);
		expect(limit).toHaveBeenCalledWith(100);
	});
});

function setupUpdate(returned: { id: string }[]) {
	const returning = vi.fn(async () => returned);
	const where = vi.fn((_predicate: SQL | undefined) => ({ returning }));
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// update chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { update }) as Database;

	return { repository: new ProjectSecretsRepository(db), set, where };
}

describe("ProjectSecretsRepository.replaceCipher", () => {
	it("writes the new ciphertext only while the row holds the expected version", async () => {
		const { repository, set, where } = setupUpdate([{ id: "row-1" }]);

		const replaced = await repository.replaceCipher("row-1", 1, {
			ciphertext: "cipher-2",
			keyVersion: 2,
		});

		expect(replaced).toBe(true);
		expect(set).toHaveBeenCalledWith({ ciphertext: "cipher-2", keyVersion: 2 });
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["row-1", 1]);
		expect(predicate.sql).toContain('"project_secrets"."key_version" = $2');
	});

	it("answers false when a newer write already changed the row", async () => {
		const { repository } = setupUpdate([]);

		expect(
			await repository.replaceCipher("row-1", 1, {
				ciphertext: "cipher-2",
				keyVersion: 2,
			}),
		).toBe(false);
	});
});
