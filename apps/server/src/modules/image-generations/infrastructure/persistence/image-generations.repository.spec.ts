import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../../infrastructure/database/database.constants";

import { ImageGenerationsRepository } from "./image-generations.repository";

type SqlCondition = {
	toQuery: (config: {
		casing: { getColumnCasing: (column: { name: string }) => string };
		escapeName: (name: string) => string;
		escapeParam: (index: number) => string;
		escapeString: (value: string) => string;
	}) => { params: unknown[]; sql: string };
};

function compileCondition(condition: unknown) {
	if (
		typeof condition !== "object" ||
		condition === null ||
		!("toQuery" in condition) ||
		typeof condition.toQuery !== "function"
	) {
		throw new Error("Expected a Drizzle SQL condition");
	}

	const { params, sql } = (condition as SqlCondition).toQuery({
		casing: { getColumnCasing: (column) => column.name },
		escapeName: (name) => `"${name.replaceAll('"', '""')}"`,
		escapeParam: (index) => `$${index + 1}`,
		escapeString: (value) => `'${value.replaceAll("'", "''")}'`,
	});

	return { params, sql: sql.replaceAll(/\s+/g, " ").trim() };
}

function repositoryWithPlacementUpdate() {
	const where = vi.fn().mockResolvedValue(undefined);
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));
	const repository = new ImageGenerationsRepository(
		{ update } as unknown as Database,
		{ capture: vi.fn() },
	);

	return { repository, where };
}

describe("ImageGenerationsRepository.updatePlacement", () => {
	it("guards failed settlement by succeeded attempt and pending placement", async () => {
		const { repository, where } = repositoryWithPlacementUpdate();

		await repository.updatePlacement("attempt-1", "project-1", {
			imageIndex: 1,
			kind: "image-src",
			reason: "page target unavailable",
			status: "failed",
			wid: "hero-image",
		});

		const condition = compileCondition(where.mock.calls[0]?.[0]);

		expect(condition.params).toEqual(["attempt-1", "project-1", "succeeded"]);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."status" = $3`,
		);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."spec"->'placement'->>'status' = 'pending'`,
		);
		expect(condition.sql).not.toContain("exists");
	});

	it("allows applied settlement from pending or an immutable placement receipt", async () => {
		const { repository, where } = repositoryWithPlacementUpdate();

		await repository.updatePlacement("attempt-1", "project-1", {
			imageIndex: 1,
			kind: "image-src",
			status: "applied",
			versionNumber: 7,
			wid: "hero-image",
		});

		const condition = compileCondition(where.mock.calls[0]?.[0]);

		expect(condition.params).toEqual([
			"attempt-1",
			"project-1",
			"succeeded",
			"project-1",
			"attempt-1",
		]);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."status" = $3`,
		);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."spec"->'placement'->>'status' = 'pending' or exists`,
		);
		expect(condition.sql).toContain(
			`from "versions" where "versions"."project_id" = $4`,
		);
		expect(condition.sql).toContain(`"versions"."meta"->>'source' = 'ai-edit'`);
		expect(condition.sql).toContain(
			`"versions"."meta"->'receipt'->>'kind' = 'image-generation-placement'`,
		);
		expect(condition.sql).toContain(
			`"versions"."meta"->'receipt'->>'attemptId' = $5`,
		);
	});
});
