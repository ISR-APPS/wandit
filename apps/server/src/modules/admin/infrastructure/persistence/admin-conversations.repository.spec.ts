import {
	adminAiFailuresResponseSchema,
	adminChatMessagesResponseSchema,
	adminGenerationAttemptDetailSchema,
} from "@wandit/contracts";
import { PgDialect } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { AdminConversationsRepository } from "./admin-conversations.repository";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const ATTEMPT_ID = "33333333-3333-4333-8333-333333333333";
const CREATED_AT = new Date("2026-08-30T10:00:00.000Z");

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: unknown) {
	return new PgDialect().sqlToQuery(query as SqlQuery);
}

function setup(...results: unknown[][]) {
	const execute = vi.fn();
	for (const rows of results) execute.mockResolvedValueOnce({ rows });

	return {
		execute,
		repository: new AdminConversationsRepository({
			execute,
		} as unknown as Database),
	};
}

describe("AdminConversationsRepository", () => {
	it("maps persisted data-ai-error parts and conservative column fallbacks", async () => {
		const fullFailure = {
			kind: "rate_limited",
			source: "gateway",
			providerLabel: "Vercel AI Gateway",
			retryable: true,
			terminal: true,
			refunded: null,
			moderationStage: null,
			providerMessage: null,
			requestId: "gateway-1",
		};
		const { repository } = setup(
			[{ total: 2 }],
			[
				{
					id: "message-1",
					role: "assistant",
					seq: 1,
					created_at: CREATED_AT,
					parts: [{ type: "data-ai-error", data: fullFailure }],
					metadata: null,
					failure_kind: "rate_limited",
					failure_source: "gateway",
					failure_provider: "Vercel AI Gateway",
					failure_provider_message: null,
					failure_request_id: "gateway-1",
					sentry_event_id: "event-1",
				},
				{
					id: "message-2",
					role: "assistant",
					seq: "2",
					created_at: CREATED_AT,
					parts: [],
					metadata: null,
					failure_kind: "timeout",
					failure_source: "ours",
					failure_provider: null,
					failure_provider_message: null,
					failure_request_id: null,
					sentry_event_id: null,
				},
			],
		);

		const response = await repository.listChatMessages(CHAT_ID, {
			page: 1,
			pageSize: 20,
		});

		expect(adminChatMessagesResponseSchema.parse(response)).toEqual(response);
		expect(response.items[0]?.failure).toEqual(fullFailure);
		expect(response.items[0]?.sentryEventId).toBe("event-1");
		expect(response.items[1]?.failure).toMatchObject({
			kind: "timeout",
			source: "ours",
			retryable: false,
			terminal: true,
		});
	});

	it("builds the six-source failures union with partial-index predicates and filters", async () => {
		const { execute, repository } = setup(
			[{ total: "1" }],
			[
				{
					surface: "chat",
					id: "message-1",
					chat_id: CHAT_ID,
					project_id: PROJECT_ID,
					user_id: "user-1",
					kind: "timeout",
					source: "ours",
					provider: null,
					provider_message: null,
					request_id: null,
					sentry_event_id: "event-1",
					created_at: CREATED_AT,
				},
			],
		);

		const response = await repository.listAiFailures({
			page: 2,
			pageSize: 10,
			kind: "timeout",
			source: "ours",
			surface: ["chat", "connector"],
			since: "2026-08-01T00:00:00.000Z",
		});

		expect(adminAiFailuresResponseSchema.parse(response)).toEqual(response);
		const listQuery = compile(execute.mock.calls[1]?.[0]);
		for (const table of [
			"messages",
			"image_generation_attempts",
			"media_generation_attempts",
			"marketing_assets",
			"connector_generation_attempts",
			"page_generation_attempts",
		]) {
			expect(listQuery.sql).toContain(table);
		}
		expect(listQuery.sql.match(/failure_kind is not null/gu)).toHaveLength(6);
		expect(listQuery.sql).toContain("order by f.created_at desc");
		expect(listQuery.params).toEqual(
			expect.arrayContaining(["timeout", "ours", "chat", "connector", 10]),
		);
	});

	it("returns only the connector attempt safe scalar subset", async () => {
		const { execute, repository } = setup([
			{
				id: ATTEMPT_ID,
				status: "failed",
				error: "Generation failed.",
				failure_kind: "provider_error",
				failure_source: "higgsfield",
				failure_provider: "higgsfield",
				failure_provider_message: null,
				failure_request_id: "request-1",
				sentry_event_id: "event-1",
				created_at: CREATED_AT,
				updated_at: CREATED_AT,
				project_id: PROJECT_ID,
				user_id: "user-1",
				raw: {
					triggerRunId: "run-1",
					connectorSlug: "higgsfield",
					toolName: "generate_video",
				},
			},
		]);

		const response = await repository.getGenerationAttempt(
			"connector",
			ATTEMPT_ID,
		);

		expect(adminGenerationAttemptDetailSchema.parse(response)).toEqual(
			response,
		);
		const query = compile(execute.mock.calls[0]?.[0]);
		expect(query.sql).toContain("a.connector_slug");
		expect(query.sql).toContain("a.tool_name");
		expect(query.sql).not.toContain("a.args");
		expect(query.sql).not.toContain("raw_receipt");
		expect(query.sql).not.toContain("a.spec");
		expect(query.sql).not.toContain("a.prompt");
	});

	it("uses per-generation tokens and cost for each joined AI call row", async () => {
		const { execute, repository } = setup(
			[{ total: 1 }],
			[
				{
					id: ATTEMPT_ID,
					operation: "chat",
					model: "anthropic/claude-sonnet",
					provider: "anthropic",
					// Event aggregates must never leak into a generation-ref row.
					input_tokens: 100,
					output_tokens: 200,
					total_tokens: 300,
					step_usage: {
						inputTokens: 3,
						outputTokens: 4,
						totalTokens: 7,
					},
					cost_usd_micros: 1_200,
					message_id: "message-1",
					gateway_generation_id: "gen-1",
					created_at: CREATED_AT,
				},
			],
		);

		const response = await repository.listChatCalls(CHAT_ID, {
			page: 1,
			pageSize: 20,
		});

		expect(response.items[0]).toMatchObject({
			id: ATTEMPT_ID,
			inputTokens: 3,
			outputTokens: 4,
			totalTokens: 7,
			costUsd: 0.0012,
		});

		const query = compile(execute.mock.calls[1]?.[0]);
		expect(query.sql).toContain("coalesce(r.id, e.id) as id");
		expect(query.sql).toContain(
			"left join ai_usage_generation_refs r on r.usage_event_id = e.id",
		);
		expect(query.sql).toContain("r.step_usage");
		expect(query.sql).toContain("else r.reconciled_cost_usd_micros");
	});
});
