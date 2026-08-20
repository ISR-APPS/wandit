import { db } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { ConnectorOperationEventsRepository } from "./connector-operation-events.repository";

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

type SqlQuery = {
	toQuery: (config: {
		casing: { getColumnCasing: (column: { name: string }) => string };
		escapeName: (name: string) => string;
		escapeParam: (index: number) => string;
		escapeString: (value: string) => string;
	}) => { params: unknown[]; sql: string };
};

function compileQuery(query: unknown): { params: unknown[]; sql: string } {
	if (
		typeof query !== "object" ||
		query === null ||
		!("toQuery" in query) ||
		typeof query.toQuery !== "function"
	) {
		throw new Error("Expected a Drizzle SQL query");
	}

	const { params, sql } = (query as SqlQuery).toQuery({
		casing: { getColumnCasing: (column) => column.name },
		escapeName: (name) => `"${name.replaceAll('"', '""')}"`,
		escapeParam: (index) => `$${index + 1}`,
		escapeString: (value) => `'${value.replaceAll("'", "''")}'`,
	});

	return { params, sql: sql.replaceAll(/\s+/g, " ").trim() };
}

function setup(rows: { createdAt: Date }[] = []) {
	const where = vi.fn();
	const limit = vi.fn().mockResolvedValue(rows);
	const orderBy = vi.fn(() => ({ limit }));
	where.mockReturnValue({ orderBy });
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const values = vi.fn().mockResolvedValue(undefined);
	const insert = vi.fn(() => ({ values }));
	const db = { insert, select } as unknown as Database;

	return {
		repository: new ConnectorOperationEventsRepository(db),
		values,
		where,
	};
}

const EVENT = {
	connectorSlug: "meta-ads",
	durationMs: 42,
	errorCode: null,
	errorMessage: null,
	feature: "ads_analysis",
	organizationId: "organization-1",
	parentEventId: "usage-event-1",
	status: "succeeded",
	toolName: "ads_get_ad_accounts",
	userId: "user-1",
} as const;

describe("ConnectorOperationEventsRepository", () => {
	it("compiles a single insert that hydrates chat correlation from the parent usage event", () => {
		const repository = new ConnectorOperationEventsRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const query = repository["buildInsert"](EVENT).toSQL();
		const statement = normalizeSql(query.sql);

		expect(statement).toContain('insert into "connector_operation_events"');
		expect(statement.match(/from "ai_usage_events"/g)).toHaveLength(2);
		expect(statement).toContain('"ai_usage_events"."chat_id"');
		expect(statement).toContain('"ai_usage_events"."message_id"');
		expect(statement.match(/"ai_usage_events"\."id" =/g)).toHaveLength(2);
		expect(query.params).toContain("usage-event-1");
		expect(query.params).toContain("ads_get_ad_accounts");
	});

	it("inserts null correlation directly when no parent usage event is available", () => {
		const repository = new ConnectorOperationEventsRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const query = repository["buildInsert"]({
			...EVENT,
			parentEventId: undefined,
		}).toSQL();

		expect(normalizeSql(query.sql)).not.toContain('from "ai_usage_events"');
		expect(query.params).not.toContain("usage-event-1");
	});

	describe("findLatestWriteAt", () => {
		it("overlaps the target ids and scopes to the organization", async () => {
			const createdAt = new Date("2026-08-19T10:00:00.000Z");
			const { repository, where } = setup([{ createdAt }]);

			await expect(
				repository.findLatestWriteAt({
					connectorSlug: "tiktok-ads",
					organizationId: "org-1",
					targetEntityIds: ["777", "778"],
					userId: "user-1",
				}),
			).resolves.toEqual(createdAt);

			const { params, sql } = compileQuery(where.mock.calls[0]?.[0]);
			expect(sql).toBe(
				'("connector_operation_events"."organization_id" = $1 and ' +
					'"connector_operation_events"."connector_slug" = $2 and ' +
					'"connector_operation_events"."feature" = $3 and ' +
					'"connector_operation_events"."status" = $4 and ' +
					'"connector_operation_events"."target_entity_ids" && ARRAY[$5, $6]::text[])',
			);
			expect(params).toEqual([
				"org-1",
				"tiktok-ads",
				"ads_launch",
				"succeeded",
				"777",
				"778",
			]);
		});

		it("scopes to the personal space when there is no organization", async () => {
			const { repository, where } = setup();

			await expect(
				repository.findLatestWriteAt({
					connectorSlug: "meta-ads",
					organizationId: null,
					targetEntityIds: ["adset-1"],
					userId: "user-1",
				}),
			).resolves.toBeNull();

			const { params, sql } = compileQuery(where.mock.calls[0]?.[0]);
			expect(sql).toContain(
				'("connector_operation_events"."user_id" = $1 and ' +
					'"connector_operation_events"."organization_id" is null)',
			);
			expect(sql).toContain(
				'"connector_operation_events"."target_entity_ids" && ARRAY[$5]::text[]',
			);
			expect(params).toEqual([
				"user-1",
				"meta-ads",
				"ads_launch",
				"succeeded",
				"adset-1",
			]);
		});

		it("never queries for an empty id list", async () => {
			const { repository, where } = setup();

			await expect(
				repository.findLatestWriteAt({
					connectorSlug: "meta-ads",
					organizationId: null,
					targetEntityIds: [],
					userId: "user-1",
				}),
			).resolves.toBeNull();
			expect(where).not.toHaveBeenCalled();
		});
	});

	describe("insert", () => {
		it("stores the target ids on one row and null when there are none", async () => {
			const { repository, values } = setup();
			const base = {
				connectorSlug: "tiktok-ads",
				durationMs: 12,
				errorCode: null,
				errorMessage: null,
				feature: "ads_launch" as const,
				organizationId: "org-1",
				status: "succeeded" as const,
				toolName: "adgroup/status/update/",
				userId: "user-1",
			};

			await repository.insert({ ...base, targetEntityIds: ["777", "778"] });
			await repository.insert({ ...base, targetEntityIds: [] });
			await repository.insert(base);

			expect(values).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({ targetEntityIds: ["777", "778"] }),
			);
			expect(values).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({ targetEntityIds: null }),
			);
			expect(values).toHaveBeenNthCalledWith(
				3,
				expect.objectContaining({ targetEntityIds: null }),
			);
		});
	});
});
