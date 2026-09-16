import { PgDialect, type SQL } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	TurnProjectRepository,
	type TurnProjectRow,
} from "./turn-project.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SQL | undefined) {
	// SAFETY: the where-mock receives real drizzle SQL chunks.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setupSelect(rows: TurnProjectRow[] = []) {
	const limit = vi.fn(async (_count: number) => rows);
	const where = vi.fn((_predicate: SQL | undefined) => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// select chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { select }) as Database;
	const repository = new TurnProjectRepository(db);

	return { repository, select, where };
}

describe("TurnProjectRepository.findForTurn", () => {
	it("selects the six turn columns scoped to the project id", async () => {
		const row: TurnProjectRow = {
			engine: "v2_app",
			framework: "tanstack-start",
			languages: ["ar", "fr"],
			networkAllowedHosts: ["api.example.com"],
			organizationId: null,
			templateVersion: "tpl-1",
			userId: "user-1",
		};
		const { repository, where } = setupSelect([row]);

		const result = await repository.findForTurn("project-1");

		expect(result).toEqual(row);
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1"]);
		expect(predicate.sql).toContain('"projects"."id" = $1');
	});

	it("returns null when the project does not exist", async () => {
		const { repository } = setupSelect([]);

		expect(await repository.findForTurn("missing")).toBeNull();
	});
});
