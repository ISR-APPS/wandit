import { PgDialect } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { AdminAuditRepository } from "./admin-audit.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

describe("AdminAuditRepository", () => {
	it("inserts a conversation view with the 15-minute guard in one statement", async () => {
		const execute = vi.fn().mockResolvedValue({ rows: [] });
		const repository = new AdminAuditRepository({
			execute,
		} as unknown as Database);
		const since = new Date("2026-08-30T11:45:00.000Z");

		await repository.insertConversationViewIfAbsent(
			{
				adminUserId: "admin-1",
				requestId: "request-1",
				targetId: "chat-1",
				targetUserId: "user-1",
			},
			since,
		);

		expect(execute).toHaveBeenCalledTimes(1);
		const query = new PgDialect().sqlToQuery(
			execute.mock.calls[0]?.[0] as SqlQuery,
		);
		expect(query.sql).toContain("insert into admin_audit_events");
		expect(query.sql).toContain("where not exists");
		expect(query.sql).toContain("recent.created_at >=");
		expect(query.params).toEqual([
			"admin-1",
			"admin.conversation.viewed",
			"user-1",
			"chat-1",
			"request-1",
			"admin-1",
			"admin.conversation.viewed",
			"chat-1",
			since,
		]);
	});
});
