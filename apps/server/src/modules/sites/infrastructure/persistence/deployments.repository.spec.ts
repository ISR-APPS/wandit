import { NotFoundException } from "@nestjs/common";
import { PgDialect, type SQL } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { DeploymentsRepository } from "./deployments.repository";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

describe("DeploymentsRepository.getAccessibleProject", () => {
	it("reads only a v1_page project, so a V2 app answers 404 on the V1 routes", async () => {
		const where = vi.fn((_predicate: SQL | undefined) => ({
			limit: async () => [],
		}));
		// SAFETY: `Object.create` yields `any`; the stub exposes only the
		// select chain `getAccessibleProject` calls.
		const db = Object.assign(Object.create(null), {
			select: () => ({ from: () => ({ where }) }),
		}) as Database;
		const repository = new DeploymentsRepository(db);

		await expect(
			repository.getAccessibleProject(
				{ kind: "personal", userId: "user-1" },
				PROJECT_ID,
			),
		).rejects.toBeInstanceOf(NotFoundException);

		const predicate = where.mock.calls[0]?.[0];
		if (!predicate) {
			throw new Error("The repository passed no SQL to the fake");
		}
		const rendered = new PgDialect().sqlToQuery(predicate);
		expect(rendered.sql).toContain('"projects"."engine" = $');
		expect(rendered.params).toContain("v1_page");
	});
});
