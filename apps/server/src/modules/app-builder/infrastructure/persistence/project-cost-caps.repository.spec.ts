import { PgDialect, type SQL } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	ProjectCostCapsRepository,
	type ProjectCostCapsRow,
} from "./project-cost-caps.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SQL | undefined) {
	// SAFETY: the where-mock receives real drizzle SQL chunks.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setupSelect(rows: ProjectCostCapsRow[] = []) {
	const limit = vi.fn(async (_count: number) => rows);
	const where = vi.fn((_predicate: SQL | undefined) => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// select chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { select }) as Database;
	const repository = new ProjectCostCapsRepository(db);

	return { repository, where };
}

describe("ProjectCostCapsRepository.findByProjectId", () => {
	it("selects the two cap columns scoped to the project id", async () => {
		const { repository, where } = setupSelect([
			{ monthlyCapCredits: 1000, perTurnCapCredits: 500 },
		]);

		const result = await repository.findByProjectId("project-1");

		expect(result).toEqual({
			monthlyCapCredits: 1000,
			perTurnCapCredits: 500,
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1"]);
		expect(predicate.sql).toContain('"project_cost_caps"."project_id" = $1');
	});

	it("returns null when the project has no caps row", async () => {
		const { repository } = setupSelect([]);

		expect(await repository.findByProjectId("missing")).toBeNull();
	});
});
