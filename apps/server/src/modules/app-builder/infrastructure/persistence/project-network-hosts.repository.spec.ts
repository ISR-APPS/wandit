import { PgDialect, type SQL } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { ProjectNetworkHostsRepository } from "./project-network-hosts.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SQL | undefined) {
	// SAFETY: the mock receives real drizzle SQL chunks.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);
	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setupUpdate(rows: { networkAllowedHosts: string[] }[]) {
	const returning = vi.fn(async () => rows);
	const where = vi.fn((_predicate: SQL | undefined) => ({ returning }));
	const set = vi.fn((_values: { networkAllowedHosts: SQL }) => ({ where }));
	const update = vi.fn(() => ({ set }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the update
	// chain the method under test calls.
	const db = Object.assign(Object.create(null), { update }) as Database;
	const repository = new ProjectNetworkHostsRepository(db);
	return { repository, set, where };
}

describe("ProjectNetworkHostsRepository.appendHost", () => {
	it("appends the host with a deduping jsonb write and returns the new list", async () => {
		const { repository, set, where } = setupUpdate([
			{ networkAllowedHosts: ["api.example.com", "api.github.com"] },
		]);

		const result = await repository.appendHost("project-1", "api.github.com");

		expect(result).toEqual(["api.example.com", "api.github.com"]);
		const setExpression = compile(set.mock.calls[0]?.[0]?.networkAllowedHosts);
		// The write concatenates the host, then re-aggregates distinct elements.
		expect(setExpression.sql).toContain("jsonb_agg(distinct");
		expect(setExpression.sql).toContain("jsonb_array_elements_text");
		expect(setExpression.params).toContain("api.github.com");
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1"]);
		expect(predicate.sql).toContain('"projects"."id" = $1');
	});

	it("returns an empty list when the project row is gone", async () => {
		const { repository } = setupUpdate([]);

		expect(await repository.appendHost("missing", "api.github.com")).toEqual(
			[],
		);
	});
});
