import { db } from "@wandit/db";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { ConnectorOperationEventsRepository } from "./connector-operation-events.repository";

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
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
});
