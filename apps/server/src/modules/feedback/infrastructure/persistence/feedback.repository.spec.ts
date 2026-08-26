import { PgDialect, sql } from "@wandit/db";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { FeedbackRepository } from "./feedback.repository";

function compileSql(expression: Parameters<PgDialect["sqlToQuery"]>[0]) {
	const { params, sql } = new PgDialect().sqlToQuery(expression);

	return {
		params,
		sql: sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setup(): FeedbackRepository {
	return new FeedbackRepository({} as Database);
}

describe("FeedbackRepository admin query SQL", () => {
	it("escapes search wildcards and applies CSV status filters", () => {
		const repository = setup();
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const filter = repository["buildAdminFilter"]({
			page: 1,
			pageSize: 20,
			q: "100%_ready",
			sort: "newest",
			status: ["new", "reviewing"],
		});

		if (!filter) {
			throw new Error("Expected an admin feedback filter");
		}

		const query = compileSql(filter);

		expect(query.sql).toContain('"feedback"."message" ilike');
		expect(query.sql).toContain('"feedback"."reporter_name" ilike');
		expect(query.sql).toContain('"feedback"."reporter_email" ilike');
		expect(query.sql).toContain('"feedback"."linear_issue_id" ilike');
		expect(query.sql).toContain('"feedback"."status" in');
		expect(query.params).toEqual([
			"%100\\%\\_ready%",
			"%100\\%\\_ready%",
			"%100\\%\\_ready%",
			"%100\\%\\_ready%",
			"new",
			"reviewing",
		]);
	});

	it("uses the explicit priority rank before newest creation time", () => {
		const repository = setup();
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const orderBy = repository["buildAdminOrderBy"]("priority");
		const query = compileSql(sql.join(orderBy, sql`, `));

		expect(query.sql).toContain(
			'case when "feedback"."priority" = \'urgent\' then 4',
		);
		expect(query.sql).toContain('when "feedback"."priority" = \'high\' then 3');
		expect(query.sql).toContain(
			'when "feedback"."priority" = \'medium\' then 2',
		);
		expect(query.sql).toContain('when "feedback"."priority" = \'low\' then 1');
		expect(query.sql).toMatch(/end desc, "feedback"\."created_at" desc$/);
	});

	it("counts recently resolved feedback from the resolved timestamp", () => {
		const repository = setup();
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production stats columns private.
		const columns = repository["adminStatsColumns"]();
		const query = compileSql(columns.resolvedLast7Days);

		expect(query.sql).toContain(
			'"feedback"."resolved_at" >= now() - interval \'7 days\'',
		);
	});
});
