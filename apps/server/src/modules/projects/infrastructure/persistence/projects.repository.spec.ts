import { PgDialect, db as realDb, sql } from "@wandit/db";
import { builderSessions } from "@wandit/db/schema/builder-sessions";
import { projects } from "@wandit/db/schema/projects";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import type { ProjectScope } from "../../domain/project-scope";
import { ProjectsRepository } from "./projects.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: unknown) {
	// SAFETY: the fake db captures real drizzle SQL wrappers as this arg.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };

/**
 * Fake db for the read path. `projectSelect` builds two aggregate
 * subqueries and one distinct-on subquery through the same `db` handle, so
 * every `select`/`selectDistinctOn` returns a self-serving chain: a
 * subquery terminates on `.as(alias)` and exposes its field names as SQL
 * fragments; the outer query terminates on `.where(...).limit(1)`.
 */
function selectClient(rows: unknown[]) {
	const selects: Record<string, unknown>[] = [];
	const wheres: unknown[] = [];

	const makeChain = (fields: Record<string, unknown>) => {
		// A subquery's callers read its fields by name; each name answers a
		// raw fragment so eq()/sql`` never see undefined.
		const proxied = Object.fromEntries(
			Object.keys(fields).map((key) => [key, sql.raw(`"sq"."${key}"`)]),
		);
		const chain = {
			as: () => proxied,
			groupBy: () => ({ as: () => proxied }),
			innerJoin: () => chain,
			leftJoin: () => chain,
			orderBy: () => ({ as: () => proxied }),
			where: (whereArg: unknown) => {
				wheres.push(whereArg);
				// Two call sites end here: the outer query takes `.limit(1)`;
				// the first-messages subquery takes `.orderBy().as(alias)`.
				return {
					limit: async () => rows,
					orderBy: () => ({ as: () => proxied }),
				};
			},
		};
		return chain;
	};

	const db = {
		select: vi.fn((fields: Record<string, unknown>) => {
			selects.push(fields);
			return { from: () => makeChain(fields) };
		}),
		selectDistinctOn: vi.fn((_on: unknown, fields: Record<string, unknown>) => {
			selects.push(fields);
			return { from: () => makeChain(fields) };
		}),
	};

	return {
		repository: new ProjectsRepository(
			// SAFETY: `Object.create` yields any; the stub exposes only the
			// select and selectDistinctOn chains the repository methods call.
			Object.assign(Object.create(null), db) as Database,
		),
		selects,
		wheres,
	};
}

/** Fake db for the soft-delete update: `update → set → where → returning`. */
function updateClient(returned: unknown[]) {
	const captured: { returning?: unknown; where?: unknown } = {};
	const returning = vi.fn(async (selection: unknown) => {
		captured.returning = selection;
		return returned;
	});
	const where = vi.fn((w: unknown) => {
		captured.where = w;
		return { returning };
	});
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));

	return {
		captured,
		repository: new ProjectsRepository(
			// SAFETY: `Object.create` yields any; the stub exposes only the
			// update chain the repository method calls.
			Object.assign(Object.create(null), { update }) as Database,
		),
		returning,
	};
}

/**
 * Fake db for the create path: `transaction(cb)` runs the callback on a
 * fake `tx` whose `insert(table).values(v)` records the write. `.returning`
 * answers one id row; a bare `await values(...)` resolves for inserts that
 * do not return.
 */
function transactionClient() {
	const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
	const tx = {
		insert: vi.fn((table: unknown) => ({
			values: vi.fn((values: Record<string, unknown>) => {
				inserts.push({ table, values });
				return Object.assign(Promise.resolve(undefined), {
					// Echo the written id so downstream inserts join on it like the
					// real RETURNING does.
					returning: async () => [{ id: values.id ?? `id-${inserts.length}` }],
				});
			}),
		})),
	};
	const db = {
		transaction: async (
			callback: (handle: typeof tx) => Promise<unknown>,
		): Promise<unknown> => callback(tx),
	};

	return {
		inserts,
		repository: new ProjectsRepository(
			// SAFETY: `Object.create` yields any; the stub exposes only the
			// transaction entry point the repository method calls.
			Object.assign(Object.create(null), {
				transaction: db.transaction,
			}) as Database,
		),
	};
}

const CREATE_INPUT = {
	chatId: "00000000-0000-0000-0000-0000000000c1",
	messageId: "00000000-0000-0000-0000-0000000000b1",
	name: "Build a page",
	projectId: "00000000-0000-0000-0000-0000000000a1",
	prompt: "Build a page",
	scope: SCOPE,
};

describe("ProjectsRepository.projectSelect", () => {
	it("selects the five engine columns on the read path", async () => {
		const { repository, selects } = selectClient([]);

		await repository.findByIdForScope(SCOPE, "project-1");

		// The last select call is the outer project query; the earlier calls
		// build the first-message and aggregate subqueries.
		const fields = selects.at(-1);
		expect(Object.keys(fields ?? {})).toEqual(
			expect.arrayContaining([
				"engine",
				"framework",
				"languages",
				"targetPlatform",
				"templateVersion",
			]),
		);
		expect(fields?.engine).toBe(projects.engine);
		expect(fields?.targetPlatform).toBe(projects.targetPlatform);
		expect(fields?.framework).toBe(projects.framework);
		expect(fields?.templateVersion).toBe(projects.templateVersion);
		expect(fields?.languages).toBe(projects.languages);
		// Compile a real SELECT from the captured field map and check the
		// column names land in the SQL.
		const rendered = realDb
			// SAFETY: the captured map holds the drizzle column/SQL fragments
			// the repository passed to db.select.
			.select((fields ?? {}) as Parameters<typeof realDb.select>[0])
			.from(projects)
			.toSQL();
		const selectSql = rendered.sql.replaceAll(/\s+/g, " ").trim();
		expect(selectSql).toContain('"engine"');
		expect(selectSql).toContain('"target_platform"');
		expect(selectSql).toContain('"framework"');
		expect(selectSql).toContain('"template_version"');
		expect(selectSql).toContain('"languages"');
	});
});

describe("ProjectsRepository.createWithChatAndFirstMessage", () => {
	it("writes engine = v2_app and a builder_sessions row when app is set", async () => {
		const { inserts, repository } = transactionClient();

		await repository.createWithChatAndFirstMessage({
			...CREATE_INPUT,
			app: {
				framework: "web-app",
				harness: "claude_code",
				languages: ["fr", "ar"],
				model: "model-1",
				targetPlatform: "web",
				templateVersion: "web-app@1.0.0",
			},
		});

		expect(inserts).toHaveLength(4);
		expect(inserts[0]?.values).toMatchObject({
			engine: "v2_app",
			framework: "web-app",
			languages: ["fr", "ar"],
			targetPlatform: "web",
			templateVersion: "web-app@1.0.0",
		});
		// The session insert is the fourth write: project, chat, message,
		// then the builder session the first turn adopts.
		expect(inserts[3]?.table).toBe(builderSessions);
		expect(inserts[3]?.values).toMatchObject({
			chatId: CREATE_INPUT.chatId,
			harness: "claude_code",
			model: "model-1",
			organizationId: null,
			providerSessionId: null,
			projectId: CREATE_INPUT.projectId,
			templateVersion: "web-app@1.0.0",
			userId: "user-1",
		});
	});

	it("keeps the V1 insert shape when app is absent", async () => {
		const { inserts, repository } = transactionClient();

		await repository.createWithChatAndFirstMessage(CREATE_INPUT);

		expect(inserts).toHaveLength(3);
		expect(inserts[0]?.values).not.toHaveProperty("engine");
	});

	it("stamps the org id on the builder session when scope is org", async () => {
		const { inserts, repository } = transactionClient();

		await repository.createWithChatAndFirstMessage({
			...CREATE_INPUT,
			app: {
				framework: "web-app",
				harness: "claude_code",
				languages: ["fr"],
				model: null,
				targetPlatform: "web",
				templateVersion: "web-app@1.0.0",
			},
			scope: {
				actorIsLimitExempt: false,
				kind: "org",
				organizationId: "org-1",
				userId: "user-1",
			},
		});

		// The session insert is the fourth write: project, chat, message,
		// then the builder session.
		expect(inserts[3]?.values).toMatchObject({
			organizationId: "org-1",
			userId: "user-1",
		});
	});
});

describe("ProjectsRepository.softDeleteByIdForScope", () => {
	it("returns the deleted row's engine", async () => {
		const { captured, repository } = updateClient([{ engine: "v2_app" }]);

		const result = await repository.softDeleteByIdForScope(SCOPE, "project-1");

		expect(result).toEqual({ engine: "v2_app" });
		expect(captured.returning).toEqual({ engine: projects.engine });
		const { sql: where } = compile(captured.where);
		expect(where).toContain('"deleted_at" is null');
	});

	it("returns null when no live row matches", async () => {
		const { repository } = updateClient([]);

		await expect(
			repository.softDeleteByIdForScope(SCOPE, "project-1"),
		).resolves.toBeNull();
	});
});
