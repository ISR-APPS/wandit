import {
	adminAiFailuresResponseSchema,
	adminChatCallsResponseSchema,
	adminChatDetailSchema,
	adminChatMessagesResponseSchema,
	adminGenerationAttemptDetailSchema,
	adminListProjectChatsResponseSchema,
} from "@wandit/contracts";
import { PgDialect } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { AdminConversationsRepository } from "./admin-conversations.repository";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const ATTEMPT_ID = "33333333-3333-4333-8333-333333333333";
const USAGE_EVENT_ID = "44444444-4444-4444-8444-444444444444";
const SECOND_CHAT_ID = "55555555-5555-4555-8555-555555555555";
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
	it("maps list token and credit totals with null-preserving aggregation", async () => {
		const { execute, repository } = setup(
			[{ total: 2 }],
			[
				{
					id: CHAT_ID,
					project_id: PROJECT_ID,
					project_name: "Project",
					created_at: CREATED_AT,
					owner_id: "user-1",
					owner_name: "Owner",
					owner_email: "owner@example.com",
					owner_image: null,
					message_count: 4,
					failed_turn_count: 1,
					last_message_at: CREATED_AT,
					total_tokens: "300",
					total_credits_centi: "250",
				},
				{
					id: SECOND_CHAT_ID,
					project_id: PROJECT_ID,
					project_name: "Project",
					created_at: CREATED_AT,
					owner_id: "user-1",
					owner_name: "Owner",
					owner_email: "owner@example.com",
					owner_image: null,
					message_count: 0,
					failed_turn_count: 0,
					last_message_at: null,
					total_tokens: null,
					total_credits_centi: null,
				},
			],
		);

		const response = await repository.listProjectChats(PROJECT_ID, {
			page: 1,
			pageSize: 20,
		});

		expect(adminListProjectChatsResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.items).toEqual([
			expect.objectContaining({
				id: CHAT_ID,
				totalCreditsCenti: 250,
				totalTokens: 300,
			}),
			expect.objectContaining({
				id: SECOND_CHAT_ID,
				totalCreditsCenti: null,
				totalTokens: null,
			}),
		]);

		const query = compile(execute.mock.calls[1]?.[0]);
		expect(query.sql).toContain(
			"when e.input_tokens is null and e.output_tokens is null then null",
		);
		expect(query.sql).toContain(
			"sum(coalesce(e.final_credits, e.reserved_credits))::bigint as total_credits_centi",
		);
		expect(query.sql).toContain("or e.parent_event_id in (");
		expect(query.sql).toContain("select parent_event.id");
		expect(query.sql).toContain("where parent_event.chat_id = c.id");
	});

	it("maps direct and child-linked chat usage without generation-ref cost duplication", async () => {
		const { execute, repository } = setup(
			[
				{
					chat_id: CHAT_ID,
					chat_created_at: CREATED_AT,
					chat_updated_at: CREATED_AT,
					project_id: PROJECT_ID,
					project_name: "Project",
					owner_id: "user-1",
					owner_name: "Owner",
					owner_email: "owner@example.com",
					owner_image: null,
					message_count: 4,
					failed_turn_count: 1,
					total_tokens: "300",
					cache_read_tokens: "120",
					cache_write_tokens: "20",
					total_cost_usd_micros: "5000",
					total_credits_centi: "250",
				},
			],
			[
				{
					operation: "chat",
					model: "anthropic/claude-sonnet",
					calls: "2",
					input_tokens: "220",
					output_tokens: "80",
					cache_read_tokens: "120",
					cache_write_tokens: "20",
					cost_usd_micros: "5000",
					credits_centi: "250",
				},
			],
		);

		const response = await repository.getChatDetail(CHAT_ID);

		expect(adminChatDetailSchema.parse(response)).toEqual(response);
		expect(response).toMatchObject({
			cacheReadTokens: 120,
			cacheWriteTokens: 20,
			totalCreditsCenti: 250,
			usageSummary: [
				{
					calls: 2,
					creditsCenti: 250,
					operation: "chat",
				},
			],
		});
		const detailQuery = compile(execute.mock.calls[0]?.[0]);
		const summaryQuery = compile(execute.mock.calls[1]?.[0]);
		expect(detailQuery.sql).toContain("or e.parent_event_id in (");
		expect(detailQuery.sql).toContain("where parent_event.chat_id = c.id");
		expect(summaryQuery.sql).toContain("group by e.operation, e.model");
		expect(summaryQuery.sql).toContain(
			"order by credits_centi desc nulls last",
		);
		expect(summaryQuery.sql).toContain("or e.parent_event_id in (");
		expect(summaryQuery.sql).toContain("select parent_event.id");
		expect(summaryQuery.sql).toContain("where parent_event.chat_id =");
		expect(summaryQuery.params).toEqual([CHAT_ID, CHAT_ID]);
		expect(summaryQuery.sql).not.toContain("ai_usage_generation_refs");
	});

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

	it("emits event and generation rows with per-generation usage", async () => {
		const { execute, repository } = setup(
			[{ total: 2 }],
			[
				{
					id: USAGE_EVENT_ID,
					operation: "chat",
					model: "anthropic/claude-sonnet",
					provider: "anthropic",
					input_tokens: 100,
					output_tokens: 20,
					cache_read_tokens: 80,
					cache_write_tokens: 5,
					total_tokens: 120,
					raw_usage: {
						outputTokenDetails: { reasoningTokens: 9 },
					},
					reserved_credits: 150,
					final_credits: 125,
					step_usage: null,
					cost_usd_micros: 2_000,
					message_id: "message-1",
					gateway_generation_id: null,
					created_at: CREATED_AT,
				},
				{
					id: ATTEMPT_ID,
					operation: "chat",
					model: "anthropic/claude-sonnet",
					provider: "anthropic",
					// Event aggregates must never leak into a generation-ref row.
					input_tokens: 100,
					output_tokens: 200,
					cache_read_tokens: 90,
					cache_write_tokens: 10,
					total_tokens: 300,
					step_usage: {
						inputTokens: 3,
						inputTokenDetails: {
							cacheReadTokens: 2,
							cacheWriteTokens: 1,
						},
						outputTokens: 4,
						outputTokenDetails: { reasoningTokens: 3 },
						totalTokens: 7,
					},
					raw_usage: {
						outputTokenDetails: { reasoningTokens: 99 },
					},
					reserved_credits: 80,
					final_credits: 75,
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

		expect(adminChatCallsResponseSchema.parse(response)).toEqual(response);
		expect(response.total).toBe(2);
		expect(response.items[0]).toMatchObject({
			id: USAGE_EVENT_ID,
			inputTokens: 100,
			cacheReadTokens: 80,
			reasoningTokens: 9,
			creditsCenti: 125,
			gatewayGenerationId: null,
		});
		expect(response.items[1]).toMatchObject({
			id: ATTEMPT_ID,
			inputTokens: 3,
			outputTokens: 4,
			cacheReadTokens: 2,
			cacheWriteTokens: 1,
			reasoningTokens: 3,
			totalTokens: 7,
			costUsd: 0.0012,
			creditsCenti: null,
		});

		const countQuery = compile(execute.mock.calls[0]?.[0]);
		const query = compile(execute.mock.calls[1]?.[0]);
		expect(countQuery.sql).toContain("union all");
		expect(query.sql).toContain("e.id as usage_event_id");
		expect(query.sql).toContain("union all");
		expect(query.sql).toContain("from ai_usage_generation_refs r");
		expect(query.sql).toContain(
			"inner join ai_usage_events e on e.id = r.usage_event_id",
		);
		expect(query.sql).toContain("e.raw_usage");
		expect(query.sql).toContain("e.reserved_credits");
		expect(query.sql).toContain("e.final_credits");
		expect(query.sql).toContain("r.step_usage");
		expect(query.sql).toContain("null::text as gateway_generation_id");
		expect(query.sql).toContain("null::jsonb as step_usage");
		expect(query.sql).toContain("null::integer");
		expect(query.sql).toContain("call_rows.row_kind asc");
		expect(countQuery.sql.match(/or e\.parent_event_id in \(/gu)).toHaveLength(
			2,
		);
		expect(query.sql.match(/or e\.parent_event_id in \(/gu)).toHaveLength(2);
		expect(query.sql.match(/from ai_usage_events parent_event/gu)).toHaveLength(
			2,
		);
		expect(countQuery.params).toEqual([CHAT_ID, CHAT_ID, CHAT_ID, CHAT_ID]);
		expect(query.params).toEqual([CHAT_ID, CHAT_ID, CHAT_ID, CHAT_ID, 20, 0]);
	});

	it("parses reasoning from object and array event usage without throwing", async () => {
		const { repository } = setup(
			[{ total: 2 }],
			[
				{
					id: USAGE_EVENT_ID,
					operation: "chat",
					model: "anthropic/claude-sonnet",
					provider: "anthropic",
					input_tokens: 100,
					output_tokens: 20,
					cache_read_tokens: 80,
					cache_write_tokens: 5,
					total_tokens: 120,
					raw_usage: {
						outputTokenDetails: { reasoningTokens: 9 },
					},
					reserved_credits: 150,
					final_credits: 125,
					step_usage: null,
					cost_usd_micros: 2_000,
					message_id: "message-1",
					gateway_generation_id: null,
					created_at: CREATED_AT,
				},
				{
					id: ATTEMPT_ID,
					operation: "chat",
					model: "anthropic/claude-sonnet",
					provider: "anthropic",
					input_tokens: 200,
					output_tokens: 40,
					cache_read_tokens: null,
					cache_write_tokens: null,
					total_tokens: 240,
					raw_usage: [
						{ outputTokenDetails: { reasoningTokens: 4 } },
						{ outputTokenDetails: { reasoningTokens: 6 } },
						{ outputTokenDetails: { reasoningTokens: "invalid" } },
					],
					reserved_credits: 90,
					final_credits: null,
					step_usage: null,
					cost_usd_micros: 3_000,
					message_id: "message-2",
					gateway_generation_id: null,
					created_at: CREATED_AT,
				},
			],
		);

		const response = await repository.listChatCalls(CHAT_ID, {
			page: 1,
			pageSize: 20,
		});

		expect(adminChatCallsResponseSchema.parse(response)).toEqual(response);
		expect(response.items).toEqual([
			expect.objectContaining({
				cacheReadTokens: 80,
				cacheWriteTokens: 5,
				creditsCenti: 125,
				reasoningTokens: 9,
			}),
			expect.objectContaining({
				creditsCenti: 90,
				reasoningTokens: 10,
			}),
		]);
	});
});
