import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminAiCall,
	type AdminAiFailure,
	type AdminAiFailuresResponse,
	type AdminChatCallsResponse,
	type AdminChatDetail,
	type AdminChatMessage,
	type AdminChatMessagesResponse,
	type AdminChatSummary,
	type AdminGenerationAttemptDetail,
	type AdminGenerationSurface,
	type AdminListChatFailuresQuery,
	type AdminListProjectChatsResponse,
	type AdminListUserChatsResponse,
	type AiErrorData,
	aiErrorDataSchema,
	type PaginationQuery,
	uuidSchema,
} from "@wandit/contracts";
import { type SQL, sql } from "@wandit/db";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

type CountDbRow = {
	total: number | string;
};

type ChatSummaryDbRow = {
	created_at: Date | string;
	failed_turn_count: number | string;
	id: string;
	last_message_at: Date | string | null;
	message_count: number | string;
	owner_email: string | null;
	owner_id: string | null;
	owner_image: string | null;
	owner_name: string | null;
	project_id: string;
	project_name: string | null;
	total_credits_centi: number | string | null;
	total_tokens: number | string | null;
};

type ChatDetailDbRow = {
	chat_created_at: Date | string;
	chat_id: string;
	chat_updated_at: Date | string;
	failed_turn_count: number | string;
	message_count: number | string;
	owner_email: string | null;
	owner_id: string | null;
	owner_image: string | null;
	owner_name: string | null;
	project_id: string | null;
	project_name: string | null;
	cache_read_tokens: number | string | null;
	cache_write_tokens: number | string | null;
	total_cost_usd_micros: number | string | null;
	total_credits_centi: number | string | null;
	total_tokens: number | string | null;
};

type ChatUsageSummaryDbRow = {
	cache_read_tokens: number | string | null;
	cache_write_tokens: number | string | null;
	calls: number | string;
	cost_usd_micros: number | string | null;
	credits_centi: number | string | null;
	input_tokens: number | string | null;
	model: string | null;
	operation: string;
	output_tokens: number | string | null;
};

type ChatMessageDbRow = {
	created_at: Date | string;
	failure_kind: string | null;
	failure_provider: string | null;
	failure_provider_message: string | null;
	failure_request_id: string | null;
	failure_source: string | null;
	id: string;
	metadata: unknown;
	parts: unknown;
	role: string;
	sentry_event_id: string | null;
	seq: number | string;
};

type AiCallDbRow = {
	cache_read_tokens: number | string | null;
	cache_write_tokens: number | string | null;
	cost_usd_micros: number | string | null;
	created_at: Date | string;
	final_credits: number | string | null;
	gateway_generation_id: string | null;
	id: string;
	input_tokens: number | string | null;
	message_id: string | null;
	model: string | null;
	operation: string;
	output_tokens: number | string | null;
	provider: string | null;
	raw_usage: unknown;
	reserved_credits: number | string | null;
	step_usage: unknown;
	total_tokens: number | string | null;
};

type AiFailureDbRow = {
	chat_id: string | null;
	created_at: Date | string;
	id: string;
	kind: string;
	project_id: string | null;
	provider: string | null;
	provider_message: string | null;
	request_id: string | null;
	sentry_event_id: string | null;
	source: string | null;
	surface: string;
	user_id: string | null;
};

type GenerationAttemptDbRow = {
	created_at: Date | string;
	error: string | null;
	failure_kind: string | null;
	failure_provider: string | null;
	failure_provider_message: string | null;
	failure_request_id: string | null;
	failure_source: string | null;
	id: string;
	project_id: string | null;
	raw: unknown;
	sentry_event_id: string | null;
	status: string;
	updated_at: Date | string | null;
	user_id: string | null;
};

@Injectable()
export class AdminConversationsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	listProjectChats(
		projectId: string,
		query: PaginationQuery,
	): Promise<AdminListProjectChatsResponse> {
		return this.listChats(sql`c.project_id = ${projectId}::uuid`, query);
	}

	listUserChats(
		userId: string,
		query: PaginationQuery,
	): Promise<AdminListUserChatsResponse> {
		// Match the existing admin user-project convention: projects.user_id is
		// the recorded owner/creator, including projects created in an org.
		return this.listChats(
			sql`p.user_id = ${userId} and p.deleted_at is null`,
			query,
		);
	}

	async getChatDetail(chatId: string): Promise<AdminChatDetail | null> {
		const [detailResult, usageSummaryResult] = await Promise.all([
			this.db.execute<ChatDetailDbRow>(sql`
				select
					c.id as chat_id,
					c.created_at as chat_created_at,
					c.updated_at as chat_updated_at,
					p.id as project_id,
					p.name as project_name,
					u.id as owner_id,
					u.name as owner_name,
					u.email as owner_email,
					u.image as owner_image,
					coalesce(message_stats.message_count, 0)::int as message_count,
					coalesce(message_stats.failed_turn_count, 0)::int as failed_turn_count,
					usage_stats.total_tokens,
					usage_stats.cache_read_tokens,
					usage_stats.cache_write_tokens,
					usage_stats.total_cost_usd_micros,
					usage_stats.total_credits_centi
				from chats c
				left join projects p on p.id = c.project_id
				left join "user" u on u.id = p.user_id
				left join lateral (
					select
						count(*)::int as message_count,
						count(*) filter (where m.failure_kind is not null)::int as failed_turn_count
					from messages m
					where m.chat_id = c.id
				) message_stats on true
				left join lateral (
					select
						sum(
							case
								when e.input_tokens is null and e.output_tokens is null then null
								else coalesce(e.input_tokens, 0) + coalesce(e.output_tokens, 0)
							end
						)::bigint as total_tokens,
						sum(e.cache_read_tokens)::bigint as cache_read_tokens,
						sum(e.cache_write_tokens)::bigint as cache_write_tokens,
						sum(
							coalesce(e.reconciled_cost_usd_micros, e.estimated_cost_usd_micros)
						)::bigint as total_cost_usd_micros,
						sum(coalesce(e.final_credits, e.reserved_credits))::bigint as total_credits_centi
					from ai_usage_events e
					where
						e.chat_id = c.id
						or e.parent_event_id in (
							select parent_event.id
							from ai_usage_events parent_event
							where parent_event.chat_id = c.id
						)
				) usage_stats on true
				where c.id = ${chatId}::uuid
				limit 1
			`),
			this.db.execute<ChatUsageSummaryDbRow>(sql`
				select
					e.operation::text as operation,
					e.model,
					count(*)::int as calls,
					sum(e.input_tokens)::bigint as input_tokens,
					sum(e.output_tokens)::bigint as output_tokens,
					sum(e.cache_read_tokens)::bigint as cache_read_tokens,
					sum(e.cache_write_tokens)::bigint as cache_write_tokens,
					sum(
						coalesce(e.reconciled_cost_usd_micros, e.estimated_cost_usd_micros)
					)::bigint as cost_usd_micros,
					sum(coalesce(e.final_credits, e.reserved_credits))::bigint as credits_centi
				from ai_usage_events e
				where
					e.chat_id = ${chatId}::uuid
					or e.parent_event_id in (
						select parent_event.id
						from ai_usage_events parent_event
						where parent_event.chat_id = ${chatId}::uuid
					)
				group by e.operation, e.model
				order by credits_centi desc nulls last
			`),
		]);

		const row = detailResult.rows[0];
		if (!row) return null;

		return {
			chat: {
				id: row.chat_id,
				createdAt: toIso(row.chat_created_at),
				updatedAt: toIso(row.chat_updated_at),
			},
			project:
				row.project_id === null || row.project_name === null
					? null
					: { id: row.project_id, name: row.project_name },
			owner: mapOwner(row),
			messageCount: toNumber(row.message_count),
			failedTurnCount: toNumber(row.failed_turn_count),
			totalTokens:
				row.total_tokens === null ? null : toNumber(row.total_tokens),
			cacheReadTokens:
				row.cache_read_tokens === null ? null : toNumber(row.cache_read_tokens),
			cacheWriteTokens:
				row.cache_write_tokens === null
					? null
					: toNumber(row.cache_write_tokens),
			totalCostUsdMicros:
				row.total_cost_usd_micros === null
					? null
					: toNumber(row.total_cost_usd_micros),
			totalCreditsCenti:
				row.total_credits_centi === null
					? null
					: toNumber(row.total_credits_centi),
			usageSummary: usageSummaryResult.rows.map(mapChatUsageSummary),
		};
	}

	async listChatMessages(
		chatId: string,
		query: PaginationQuery,
	): Promise<AdminChatMessagesResponse> {
		const offset = paginationOffset(query);
		const [countResult, listResult] = await Promise.all([
			this.db.execute<CountDbRow>(sql`
				select count(*)::int as total
				from messages m
				where m.chat_id = ${chatId}::uuid
			`),
			this.db.execute<ChatMessageDbRow>(sql`
				select
					m.id,
					m.role::text as role,
					m.seq,
					m.created_at,
					m.parts,
					m.metadata,
					m.failure_kind,
					m.failure_source,
					m.failure_provider,
					m.failure_provider_message,
					m.failure_request_id,
					m.sentry_event_id
				from messages m
				where m.chat_id = ${chatId}::uuid
				order by m.seq asc
				limit ${query.pageSize}
				offset ${offset}
			`),
		]);

		return {
			items: listResult.rows.map(mapChatMessage),
			page: query.page,
			pageSize: query.pageSize,
			total: toNumber(countResult.rows[0]?.total ?? 0),
		};
	}

	async listChatCalls(
		chatId: string,
		query: PaginationQuery,
	): Promise<AdminChatCallsResponse> {
		const offset = paginationOffset(query);
		const calls = chatCallRows(chatId);
		const [countResult, listResult] = await Promise.all([
			this.db.execute<CountDbRow>(sql`
				select count(*)::int as total
				from (${calls}) call_rows
			`),
			this.db.execute<AiCallDbRow>(sql`
				select
					call_rows.id,
					call_rows.operation,
					call_rows.model,
					call_rows.provider,
					call_rows.input_tokens,
					call_rows.output_tokens,
					call_rows.cache_read_tokens,
					call_rows.cache_write_tokens,
					call_rows.total_tokens,
					call_rows.cost_usd_micros,
					call_rows.message_id,
					call_rows.gateway_generation_id,
					call_rows.raw_usage,
					call_rows.reserved_credits,
					call_rows.final_credits,
					call_rows.step_usage,
					call_rows.created_at
				from (${calls}) call_rows
				order by
					call_rows.created_at desc,
					call_rows.usage_event_id desc,
					call_rows.row_kind asc,
					call_rows.id desc
				limit ${query.pageSize}
				offset ${offset}
			`),
		]);

		return {
			items: listResult.rows.map(mapAiCall),
			page: query.page,
			pageSize: query.pageSize,
			total: toNumber(countResult.rows[0]?.total ?? 0),
		};
	}

	async listAiFailures(
		query: AdminListChatFailuresQuery,
	): Promise<AdminAiFailuresResponse> {
		const failures = aiFailuresUnion();
		const filter = aiFailuresFilter(query);
		const offset = paginationOffset(query);
		const [countResult, listResult] = await Promise.all([
			this.db.execute<CountDbRow>(sql`
				with failures as (${failures})
				select count(*)::int as total
				from failures f
				where ${filter}
			`),
			this.db.execute<AiFailureDbRow>(sql`
				with failures as (${failures})
				select
					f.surface,
					f.id,
					f.chat_id,
					f.project_id,
					f.user_id,
					f.kind,
					f.source,
					f.provider,
					f.provider_message,
					f.request_id,
					f.sentry_event_id,
					f.created_at
				from failures f
				where ${filter}
				order by f.created_at desc, f.surface asc, f.id desc
				limit ${query.pageSize}
				offset ${offset}
			`),
		]);

		return {
			items: listResult.rows.map(mapAiFailure),
			page: query.page,
			pageSize: query.pageSize,
			total: toNumber(countResult.rows[0]?.total ?? 0),
		};
	}

	async getGenerationAttempt(
		surface: AdminGenerationSurface,
		attemptId: string,
	): Promise<AdminGenerationAttemptDetail | null> {
		if (!uuidSchema.safeParse(attemptId).success) return null;

		const result = await this.db.execute<GenerationAttemptDbRow>(
			generationAttemptQuery(surface, attemptId),
		);
		const row = result.rows[0];
		if (!row) return null;

		return {
			surface,
			id: row.id,
			status: row.status,
			error: row.error,
			kind: row.failure_kind,
			source: row.failure_source,
			provider: row.failure_provider,
			providerMessage: row.failure_provider_message,
			requestId: row.failure_request_id,
			sentryEventId: row.sentry_event_id,
			createdAt: toIso(row.created_at),
			updatedAt: row.updated_at === null ? null : toIso(row.updated_at),
			projectId: row.project_id,
			userId: row.user_id,
			raw: isRecord(row.raw) ? row.raw : {},
		};
	}

	private async listChats(
		filter: SQL,
		query: PaginationQuery,
	): Promise<AdminListProjectChatsResponse> {
		const offset = paginationOffset(query);
		const [countResult, listResult] = await Promise.all([
			this.db.execute<CountDbRow>(sql`
				select count(*)::int as total
				from chats c
				inner join projects p on p.id = c.project_id
				where ${filter}
			`),
			this.db.execute<ChatSummaryDbRow>(sql`
				select
					c.id,
					c.project_id,
					p.name as project_name,
					c.created_at,
					u.id as owner_id,
					u.name as owner_name,
					u.email as owner_email,
					u.image as owner_image,
					coalesce(message_stats.message_count, 0)::int as message_count,
					coalesce(message_stats.failed_turn_count, 0)::int as failed_turn_count,
					message_stats.last_message_at,
					usage_stats.total_tokens,
					usage_stats.total_credits_centi
				from chats c
				inner join projects p on p.id = c.project_id
				left join "user" u on u.id = p.user_id
				left join lateral (
					select
						count(*)::int as message_count,
						count(*) filter (where m.failure_kind is not null)::int as failed_turn_count,
						max(m.created_at) as last_message_at
					from messages m
					where m.chat_id = c.id
				) message_stats on true
				left join lateral (
					select
						sum(
							case
								when e.input_tokens is null and e.output_tokens is null then null
								else coalesce(e.input_tokens, 0) + coalesce(e.output_tokens, 0)
							end
						)::bigint as total_tokens,
						sum(coalesce(e.final_credits, e.reserved_credits))::bigint as total_credits_centi
					from ai_usage_events e
					where
						e.chat_id = c.id
						or e.parent_event_id in (
							select parent_event.id
							from ai_usage_events parent_event
							where parent_event.chat_id = c.id
						)
				) usage_stats on true
				where ${filter}
				order by c.updated_at desc, c.id desc
				limit ${query.pageSize}
				offset ${offset}
			`),
		]);

		return {
			items: listResult.rows.map(mapChatSummary),
			page: query.page,
			pageSize: query.pageSize,
			total: toNumber(countResult.rows[0]?.total ?? 0),
		};
	}
}

function mapChatSummary(row: ChatSummaryDbRow): AdminChatSummary {
	return {
		id: row.id,
		projectId: row.project_id,
		projectName: row.project_name,
		messageCount: toNumber(row.message_count),
		failedTurnCount: toNumber(row.failed_turn_count),
		totalTokens: row.total_tokens === null ? null : toNumber(row.total_tokens),
		totalCreditsCenti:
			row.total_credits_centi === null
				? null
				: toNumber(row.total_credits_centi),
		lastMessageAt:
			row.last_message_at === null ? null : toIso(row.last_message_at),
		createdAt: toIso(row.created_at),
		owner: mapOwner(row),
	};
}

function mapChatUsageSummary(
	row: ChatUsageSummaryDbRow,
): AdminChatDetail["usageSummary"][number] {
	return {
		operation: row.operation,
		model: row.model,
		calls: toNumber(row.calls),
		inputTokens: row.input_tokens === null ? null : toNumber(row.input_tokens),
		outputTokens:
			row.output_tokens === null ? null : toNumber(row.output_tokens),
		cacheReadTokens:
			row.cache_read_tokens === null ? null : toNumber(row.cache_read_tokens),
		cacheWriteTokens:
			row.cache_write_tokens === null ? null : toNumber(row.cache_write_tokens),
		costUsdMicros:
			row.cost_usd_micros === null ? null : toNumber(row.cost_usd_micros),
		creditsCenti:
			row.credits_centi === null ? null : toNumber(row.credits_centi),
	};
}

function mapOwner(row: {
	owner_email: string | null;
	owner_id: string | null;
	owner_image: string | null;
	owner_name: string | null;
}): AdminChatSummary["owner"] {
	if (
		row.owner_id === null ||
		row.owner_name === null ||
		row.owner_email === null
	) {
		return null;
	}

	return {
		id: row.owner_id,
		name: row.owner_name,
		email: row.owner_email,
		image: row.owner_image,
	};
}

function mapChatMessage(row: ChatMessageDbRow): AdminChatMessage {
	const parts = Array.isArray(row.parts) ? row.parts : [];

	return {
		id: row.id,
		role: mapMessageRole(row.role),
		seq: toNumber(row.seq),
		createdAt: toIso(row.created_at),
		parts,
		metadata: row.metadata ?? null,
		failure: persistedPartFailure(parts) ?? failureFromColumns(row),
		sentryEventId: row.sentry_event_id,
	};
}

function persistedPartFailure(parts: unknown[]): AiErrorData | null {
	for (const part of parts) {
		if (!isRecord(part) || part.type !== "data-ai-error") continue;

		const parsed = aiErrorDataSchema.safeParse(part.data);
		if (parsed.success) return parsed.data;
	}

	return null;
}

function failureFromColumns(row: ChatMessageDbRow): AiErrorData | null {
	if (row.failure_kind === null) return null;

	const parsed = aiErrorDataSchema.safeParse({
		kind: row.failure_kind,
		source: row.failure_source ?? "unknown",
		providerLabel: truncateNullable(row.failure_provider, 40),
		retryable: false,
		terminal: true,
		refunded: null,
		moderationStage: null,
		providerMessage: truncateNullable(row.failure_provider_message, 240),
		requestId: truncateNullable(row.failure_request_id, 80),
	});

	if (parsed.success) return parsed.data;

	return {
		kind: "unknown",
		source: "unknown",
		providerLabel: truncateNullable(row.failure_provider, 40),
		retryable: false,
		terminal: true,
		refunded: null,
		moderationStage: null,
		providerMessage: truncateNullable(row.failure_provider_message, 240),
		requestId: truncateNullable(row.failure_request_id, 80),
	};
}

function mapAiCall(row: AiCallDbRow): AdminAiCall {
	const isGenerationRef = row.gateway_generation_id !== null;
	const generationUsage = tokenUsageFromStepUsage(row.step_usage);

	return {
		id: row.id,
		operation: row.operation,
		model: row.model,
		provider: row.provider,
		inputTokens: isGenerationRef
			? generationUsage.inputTokens
			: row.input_tokens === null
				? null
				: toNumber(row.input_tokens),
		outputTokens: isGenerationRef
			? generationUsage.outputTokens
			: row.output_tokens === null
				? null
				: toNumber(row.output_tokens),
		cacheReadTokens: isGenerationRef
			? generationUsage.cacheReadTokens
			: row.cache_read_tokens === null
				? null
				: toNumber(row.cache_read_tokens),
		cacheWriteTokens: isGenerationRef
			? generationUsage.cacheWriteTokens
			: row.cache_write_tokens === null
				? null
				: toNumber(row.cache_write_tokens),
		reasoningTokens: isGenerationRef
			? generationUsage.reasoningTokens
			: reasoningTokensFromRawUsage(row.raw_usage),
		totalTokens: isGenerationRef
			? generationUsage.totalTokens
			: row.total_tokens === null
				? null
				: toNumber(row.total_tokens),
		costUsd:
			row.cost_usd_micros === null
				? null
				: toNumber(row.cost_usd_micros) / 1_000_000,
		creditsCenti: isGenerationRef
			? null
			: row.final_credits === null
				? row.reserved_credits === null
					? null
					: toNumber(row.reserved_credits)
				: toNumber(row.final_credits),
		messageId: row.message_id,
		gatewayGenerationId: row.gateway_generation_id,
		createdAt: toIso(row.created_at),
	};
}

type RefTokenUsage = {
	cacheReadTokens: number | null;
	cacheWriteTokens: number | null;
	inputTokens: number | null;
	outputTokens: number | null;
	reasoningTokens: number | null;
	totalTokens: number | null;
};

function tokenUsageFromStepUsage(value: unknown): RefTokenUsage {
	const usage = tokenUsageRecord(value);
	const inputTokenDetails = nestedRecord(usage, "inputTokenDetails");
	const outputTokenDetails = nestedRecord(usage, "outputTokenDetails");
	const inputTokens = tokenCount(usage?.inputTokens);
	const outputTokens = tokenCount(usage?.outputTokens);
	const explicitTotal = tokenCount(usage?.totalTokens);
	const cacheReadTokens = tokenCount(inputTokenDetails?.cacheReadTokens);
	const cacheWriteTokens = tokenCount(inputTokenDetails?.cacheWriteTokens);
	const reasoningTokens = tokenCount(outputTokenDetails?.reasoningTokens);
	const totalTokens =
		explicitTotal ??
		(inputTokens === null && outputTokens === null
			? null
			: (inputTokens ?? 0) + (outputTokens ?? 0));

	return {
		cacheReadTokens,
		cacheWriteTokens,
		inputTokens,
		outputTokens,
		reasoningTokens,
		totalTokens,
	};
}

function reasoningTokensFromRawUsage(value: unknown): number | null {
	if (!Array.isArray(value)) {
		return tokenUsageFromStepUsage(value).reasoningTokens;
	}

	let total: number | null = null;
	for (const step of value) {
		const reasoningTokens = tokenUsageFromStepUsage(step).reasoningTokens;
		if (reasoningTokens === null) continue;

		const nextTotal: number = (total ?? 0) + reasoningTokens;
		if (!Number.isSafeInteger(nextTotal)) return null;
		total = nextTotal;
	}

	return total;
}

function tokenUsageRecord(value: unknown): Record<string, unknown> | null {
	if (Array.isArray(value) || !isRecord(value)) return null;

	return Array.isArray(value.providerUsage) || !isRecord(value.providerUsage)
		? value
		: value.providerUsage;
}

function nestedRecord(
	value: Record<string, unknown> | null,
	key: string,
): Record<string, unknown> | null {
	const nested = value?.[key];
	return Array.isArray(nested) || !isRecord(nested) ? null : nested;
}

function tokenCount(value: unknown): number | null {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
		? value
		: null;
}

function mapAiFailure(row: AiFailureDbRow): AdminAiFailure {
	return {
		surface: mapFailureSurface(row.surface),
		id: row.id,
		chatId: row.chat_id,
		projectId: row.project_id,
		userId: row.user_id,
		kind: row.kind,
		source: row.source ?? "unknown",
		provider: row.provider,
		providerMessage: row.provider_message,
		requestId: row.request_id,
		sentryEventId: row.sentry_event_id,
		createdAt: toIso(row.created_at),
	};
}

function chatCallRows(chatId: string): SQL {
	return sql`
		select
			e.id,
			e.operation::text as operation,
			e.model,
			e.provider,
			e.input_tokens,
			e.output_tokens,
			e.cache_read_tokens,
			e.cache_write_tokens,
			case
				when e.input_tokens is null and e.output_tokens is null then null
				else coalesce(e.input_tokens, 0) + coalesce(e.output_tokens, 0)
			end as total_tokens,
			coalesce(
				e.reconciled_cost_usd_micros,
				e.estimated_cost_usd_micros
			) as cost_usd_micros,
			e.message_id,
			null::text as gateway_generation_id,
			e.raw_usage,
			e.reserved_credits,
			e.final_credits,
			null::jsonb as step_usage,
			e.created_at,
			e.id as usage_event_id,
			0::int as row_kind
		from ai_usage_events e
		where
			e.chat_id = ${chatId}::uuid
			or e.parent_event_id in (
				select parent_event.id
				from ai_usage_events parent_event
				where parent_event.chat_id = ${chatId}::uuid
			)

		union all

		select
			r.id,
			e.operation::text,
			e.model,
			e.provider,
			null::integer,
			null::integer,
			null::integer,
			null::integer,
			null::integer,
			r.reconciled_cost_usd_micros,
			e.message_id,
			r.gateway_generation_id,
			null::jsonb,
			null::integer,
			null::integer,
			r.step_usage,
			e.created_at,
			e.id,
			1::int
		from ai_usage_generation_refs r
		inner join ai_usage_events e on e.id = r.usage_event_id
		where
			e.chat_id = ${chatId}::uuid
			or e.parent_event_id in (
				select parent_event.id
				from ai_usage_events parent_event
				where parent_event.chat_id = ${chatId}::uuid
			)
	`;
}

function aiFailuresUnion(): SQL {
	return sql`
		select
			'chat'::text as surface,
			m.id::text as id,
			m.chat_id,
			c.project_id,
			p.user_id,
			m.failure_kind as kind,
			m.failure_source as source,
			m.failure_provider as provider,
			m.failure_provider_message as provider_message,
			m.failure_request_id as request_id,
			m.sentry_event_id,
			m.created_at
		from messages m
		inner join chats c on c.id = m.chat_id
		inner join projects p on p.id = c.project_id
		where m.failure_kind is not null

		union all

		select
			'image',
			a.id::text,
			a.chat_id,
			a.project_id,
			p.user_id,
			a.failure_kind,
			a.failure_source,
			a.failure_provider,
			a.failure_provider_message,
			a.failure_request_id,
			a.sentry_event_id,
			a.created_at
		from image_generation_attempts a
		inner join projects p on p.id = a.project_id
		where a.failure_kind is not null

		union all

		select
			'marketing',
			a.id::text,
			a.chat_id,
			a.project_id,
			p.user_id,
			a.failure_kind,
			a.failure_source,
			a.failure_provider,
			a.failure_provider_message,
			a.failure_request_id,
			a.sentry_event_id,
			a.created_at
		from marketing_assets a
		inner join projects p on p.id = a.project_id
		where a.failure_kind is not null

		union all

		select
			'connector',
			a.id::text,
			a.chat_id,
			c.project_id,
			a.user_id,
			a.failure_kind,
			a.failure_source,
			a.failure_provider,
			a.failure_provider_message,
			a.failure_request_id,
			a.sentry_event_id,
			a.created_at
		from connector_generation_attempts a
		left join chats c on c.id = a.chat_id
		where a.failure_kind is not null

		union all

		select
			'page',
			a.id::text,
			a.chat_id,
			a.project_id,
			p.user_id,
			a.failure_kind,
			a.failure_source,
			a.failure_provider,
			a.failure_provider_message,
			a.failure_request_id,
			a.sentry_event_id,
			a.created_at
		from page_generation_attempts a
		inner join projects p on p.id = a.project_id
		where a.failure_kind is not null
	`;
}

function aiFailuresFilter(query: AdminListChatFailuresQuery): SQL {
	const filters: SQL[] = [sql`true`];

	if (query.kind !== undefined) filters.push(sql`f.kind = ${query.kind}`);
	if (query.source !== undefined) filters.push(sql`f.source = ${query.source}`);
	if (query.provider !== undefined) {
		filters.push(sql`f.provider = ${query.provider}`);
	}
	if (query.surface !== undefined) {
		filters.push(
			sql`f.surface in (${sql.join(
				query.surface.map((surface) => sql`${surface}`),
				sql`, `,
			)})`,
		);
	}
	if (query.since !== undefined) {
		filters.push(sql`f.created_at >= ${query.since}::timestamptz`);
	}

	return sql.join(filters, sql` and `);
}

function generationAttemptQuery(
	surface: AdminGenerationSurface,
	attemptId: string,
): SQL {
	switch (surface) {
		case "image":
			return sql`
				select
					a.id::text as id,
					a.status::text as status,
					a.error,
					a.failure_kind,
					a.failure_source,
					a.failure_provider,
					a.failure_provider_message,
					a.failure_request_id,
					a.sentry_event_id,
					a.created_at,
					coalesce(a.completed_at, a.started_at) as updated_at,
					a.project_id,
					p.user_id,
					jsonb_build_object(
						'triggerRunId', a.trigger_run_id,
						'title', a.title,
						'aspect', a.aspect::text,
						'count', a.count,
						'startedAt', a.started_at,
						'completedAt', a.completed_at
					) as raw
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				where a.id = ${attemptId}::uuid
				limit 1
			`;

		case "marketing":
			return sql`
				select
					a.id::text as id,
					a.status::text as status,
					a.error,
					a.failure_kind,
					a.failure_source,
					a.failure_provider,
					a.failure_provider_message,
					a.failure_request_id,
					a.sentry_event_id,
					a.created_at,
					coalesce(a.completed_at, a.started_at) as updated_at,
					a.project_id,
					p.user_id,
					jsonb_build_object(
						'triggerRunId', a.trigger_run_id,
						'assetType', a.asset_type::text,
						'name', a.name,
						'startedAt', a.started_at,
						'completedAt', a.completed_at
					) as raw
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				where a.id = ${attemptId}::uuid
				limit 1
			`;

		case "connector":
			return sql`
				select
					a.id::text as id,
					a.status::text as status,
					a.error,
					a.failure_kind,
					a.failure_source,
					a.failure_provider,
					a.failure_provider_message,
					a.failure_request_id,
					a.sentry_event_id,
					a.created_at,
					coalesce(a.completed_at, a.started_at) as updated_at,
					c.project_id,
					a.user_id,
					jsonb_build_object(
						'triggerRunId', a.trigger_run_id,
						'connectorSlug', a.connector_slug,
						'toolName', a.tool_name,
						'startedAt', a.started_at,
						'completedAt', a.completed_at
					) as raw
				from connector_generation_attempts a
				left join chats c on c.id = a.chat_id
				where a.id = ${attemptId}::uuid
				limit 1
			`;

		case "page":
			return sql`
				select
					a.id::text as id,
					a.status::text as status,
					a.error,
					a.failure_kind,
					a.failure_source,
					a.failure_provider,
					a.failure_provider_message,
					a.failure_request_id,
					a.sentry_event_id,
					a.created_at,
					coalesce(a.completed_at, a.started_at) as updated_at,
					a.project_id,
					p.user_id,
					jsonb_build_object(
						'triggerRunId', a.trigger_run_id,
						'model', a.model,
						'failureCode', a.failure_code,
						'lastProgressPercent', a.last_progress_percent,
						'startedAt', a.started_at,
						'completedAt', a.completed_at
					) as raw
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				where a.id = ${attemptId}::uuid
				limit 1
			`;
	}
}

function mapMessageRole(role: string): AdminChatMessage["role"] {
	if (role === "user" || role === "assistant" || role === "system") {
		return role;
	}

	return "system";
}

function mapFailureSurface(surface: string): AdminAiFailure["surface"] {
	switch (surface) {
		case "chat":
		case "image":
		case "marketing":
		case "connector":
		case "page":
			return surface;
		default:
			return "chat";
	}
}

function paginationOffset(query: PaginationQuery): number {
	return (query.page - 1) * query.pageSize;
}

function truncateNullable(value: string | null, max: number): string | null {
	return value === null ? null : value.slice(0, max);
}

function toIso(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toNumber(value: number | string): number {
	return typeof value === "number" ? value : Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
