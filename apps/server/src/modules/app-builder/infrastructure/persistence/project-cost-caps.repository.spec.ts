import { PgDialect, type SQL } from "@wandit/db";
import { projectCostCaps } from "@wandit/db/schema/project-cost-caps";
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

function setupUpsert(returned: ProjectCostCapsRow[]) {
	const returning = vi.fn(async () => returned);
	const onConflictDoUpdate = vi.fn(() => ({ returning }));
	const values = vi.fn(() => ({ onConflictDoUpdate }));
	const insert = vi.fn(() => ({ values }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// insert chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { insert }) as Database;
	const repository = new ProjectCostCapsRepository(db);

	return { onConflictDoUpdate, repository, values };
}

describe("ProjectCostCapsRepository.upsert", () => {
	it("inserts the cap row and updates it on a project-id conflict", async () => {
		const { onConflictDoUpdate, repository, values } = setupUpsert([
			{ monthlyCapCredits: 10_000, perTurnCapCredits: 5000 },
		]);

		const result = await repository.upsert(
			"project-1",
			{ monthlyCapCredits: 10_000, perTurnCapCredits: 5000 },
			"user-1",
		);

		expect(result).toEqual({
			monthlyCapCredits: 10_000,
			perTurnCapCredits: 5000,
		});
		expect(values).toHaveBeenCalledWith({
			projectId: "project-1",
			monthlyCapCredits: 10_000,
			perTurnCapCredits: 5000,
			updatedByUserId: "user-1",
		});
		expect(onConflictDoUpdate).toHaveBeenCalledWith({
			target: projectCostCaps.projectId,
			set: {
				monthlyCapCredits: 10_000,
				perTurnCapCredits: 5000,
				updatedByUserId: "user-1",
				updatedAt: expect.any(Date),
			},
		});
	});

	it("stores null caps back to the plan default", async () => {
		const { repository, values } = setupUpsert([
			{ monthlyCapCredits: null, perTurnCapCredits: null },
		]);

		await repository.upsert(
			"project-1",
			{ monthlyCapCredits: null, perTurnCapCredits: null },
			"user-1",
		);

		expect(values).toHaveBeenCalledWith({
			projectId: "project-1",
			monthlyCapCredits: null,
			perTurnCapCredits: null,
			updatedByUserId: "user-1",
		});
	});

	it("throws when the upsert returns no row", async () => {
		const { repository } = setupUpsert([]);

		await expect(
			repository.upsert(
				"project-1",
				{ monthlyCapCredits: 10_000, perTurnCapCredits: 5000 },
				"user-1",
			),
		).rejects.toThrow("project_cost_caps upsert returned no row");
	});
});
