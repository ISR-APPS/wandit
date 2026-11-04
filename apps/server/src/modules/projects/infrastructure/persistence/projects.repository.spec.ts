import { type alias, PgDialect, type SQL, sql } from "@wandit/db";
import { builderSessions } from "@wandit/db/schema/builder-sessions";
import { projects } from "@wandit/db/schema/projects";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopeFrom,
} from "../../domain/project-scope";
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

const SCOPE: ProjectScope = projectScopeFrom(undefined, "user-1");

/** A table, an alias, or the fields of a fake subquery: the first argument of a join. */
type JoinedTable = Parameters<typeof alias>[0] | Record<string, SQL>;

/**
 * Fake db for the read path. `projectSelect` builds two aggregate subqueries
 * and one distinct-on subquery through the same `db` handle. So every select
 * gives one chain. A subquery ends on `.as(alias)` and gives its field names as
 * SQL fragments. The outer query is a promise of `rows`. The chain keeps each
 * left-join condition and each filter, so a case can compile them.
 */
function selectClient(rows: unknown[]) {
	const joins: (SQL | undefined)[] = [];
	const wheres: (SQL | undefined)[] = [];

	const makeChain = (fields: Record<string, unknown>) => {
		// A subquery's callers read its fields by name; each name answers a
		// raw fragment so eq()/sql`` never see undefined.
		const proxied = Object.fromEntries(
			Object.keys(fields).map((key) => [key, sql.raw(`"sq"."${key}"`)]),
		);
		const chain = Object.assign(Promise.resolve(rows), {
			as: () => proxied,
			groupBy: () => chain,
			innerJoin: () => chain,
			leftJoin: (_table: JoinedTable, on: SQL | undefined) => {
				joins.push(on);
				return chain;
			},
			limit: () => chain,
			offset: () => chain,
			orderBy: () => chain,
			where: (where: SQL | undefined) => {
				wheres.push(where);
				return chain;
			},
		});
		return chain;
	};

	const db = {
		select: vi.fn((fields: Record<string, unknown>) => ({
			from: () => makeChain(fields),
		})),
		selectDistinctOn: vi.fn(
			(_on: unknown, fields: Record<string, unknown>) => ({
				from: () => makeChain(fields),
			}),
		),
	};

	return {
		joins,
		repository: new ProjectsRepository(
			// SAFETY: `Object.create` yields any; the stub exposes only the
			// select and selectDistinctOn chains the repository methods call.
			Object.assign(Object.create(null), db) as Database,
		),
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

// The four access joins in order: team org, personal org, the actor's member row, the actor's grant.
// The member join reads the coalesced workspace id. A join on `projects.organization_id`
// gives every member of a personal workspace a 404.
const ACCESS_JOINS = [
	{ params: [], sql: '"team_workspace"."id" = "projects"."organization_id"' },
	{
		params: [],
		sql: '("projects"."organization_id" is null and "personal_workspace"."personal_owner_user_id" = "projects"."user_id")',
	},
	{
		params: ["user-1"],
		sql: '("member"."organization_id" = coalesce("team_workspace"."id", "personal_workspace"."id") and "member"."user_id" = $1)',
	},
	{
		params: ["user-1"],
		sql: '("project_members"."project_id" = "projects"."id" and "project_members"."user_id" = $1)',
	},
];

describe("ProjectsRepository access queries", () => {
	it("findAccessFacts joins the actor's member row and grant on one live project", async () => {
		const { joins, repository, wheres } = selectClient([]);

		await repository.findAccessFacts("project-1", "user-1");

		expect(joins.map(compile)).toEqual(ACCESS_JOINS);
		expect(wheres.map(compile)).toEqual([
			{
				params: ["project-1"],
				sql: '("projects"."id" = $1 and "projects"."deleted_at" is null)',
			},
		]);
	});

	it("listSharedWithActor keeps only the live V2 projects that the actor has a grant on", async () => {
		const { joins, repository, wheres } = selectClient([]);

		await repository.listSharedWithActor("user-1");

		// The list joins the subqueries first, then the same four access joins.
		expect(joins.slice(-4).map(compile)).toEqual(ACCESS_JOINS);
		// Without the grant filter, the list shows every project of the actor's workspaces.
		expect(compile(wheres.at(-1))).toEqual({
			params: ["user-1", "v2_app"],
			sql: '("project_members"."user_id" = $1 and "projects"."engine" = $2 and "projects"."deleted_at" is null)',
		});
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

	it("writes a mobile app block to the project row and the session", async () => {
		const { inserts, repository } = transactionClient();

		await repository.createWithChatAndFirstMessage({
			...CREATE_INPUT,
			app: {
				framework: "mobile-app",
				harness: "claude_code",
				languages: ["en"],
				model: null,
				targetPlatform: "mobile",
				templateVersion: "mobile-app@1.0.0",
			},
		});

		expect(inserts[0]?.values).toMatchObject({
			engine: "v2_app",
			framework: "mobile-app",
			targetPlatform: "mobile",
			templateVersion: "mobile-app@1.0.0",
		});
		expect(inserts[3]?.values).toMatchObject({
			templateVersion: "mobile-app@1.0.0",
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
				actorRoles: ["member"],
				kind: "org",
				organizationId: "org-1",
				actorUserId: "user-1",
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
