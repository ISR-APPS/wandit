import { PgDialect, type SQL } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { ProjectLivenessRepository } from "./project-liveness.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SQL | undefined) {
	// SAFETY: the where-mock receives real drizzle SQL chunks.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setupSelect(rows: { id: string }[]) {
	const where = vi.fn(async (_predicate: SQL | undefined) => rows);
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// select chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { select }) as Database;

	return { repository: new ProjectLivenessRepository(db), select, where };
}

describe("ProjectLivenessRepository.listLiveIds", () => {
	it("keeps the ids of rows that exist and are not soft-deleted", async () => {
		const { repository, where } = setupSelect([{ id: "project-live" }]);

		const live = await repository.listLiveIds(["project-live", "project-gone"]);

		expect(live).toEqual(new Set(["project-live"]));
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-live", "project-gone"]);
		expect(predicate.sql).toContain('"projects"."id" in ($1, $2)');
		expect(predicate.sql).toContain('"projects"."deleted_at" is null');
	});

	it("sends no query for an empty list", async () => {
		const { repository, select } = setupSelect([]);

		expect(await repository.listLiveIds([])).toEqual(new Set());
		expect(select).not.toHaveBeenCalled();
	});
});
