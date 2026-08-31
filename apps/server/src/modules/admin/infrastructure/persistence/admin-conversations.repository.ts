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
	total_cost_usd_micros: number | string | null;
	total_tokens: number | string | null;
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
	cost_usd_micros: number | string | null;
	created_at: Date | string;
	gateway_generation_id: string | null;
	id: string;
	input_tokens: number | string | null;
	message_id: string | null;
	model: string | null;
	operation: string;
	output_tokens: number | string | null;
	provider: string | null;
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
		const result = await this.db.execute<ChatDetailDbRow>(sql`
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
				usage_stats.total_cost_usd_micros
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
					sum(
						coalesce(e.reconciled_cost_usd_micros, e.estimated_cost_usd_micros)
					)::bigint as total_cost_usd_micros
				from ai_usage_events e
				where e.chat_id = c.id
			) usage_stats on true
			where c.id = ${chatId}::uuid
			limit 1
		`);

		const row = result.rows[0];
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
			totalCostUsdMicros:
				row.total_cost_usd_micros === null
					? null
					: toNumber(row.total_cost_usd_micros),
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
		const [countResult, listResult] = await Promise.all([
			this.db.execute<CountDbRow>(sql`
				select count(*)::int as total
				from ai_usage_events e
				left join ai_usage_generation_refs r on r.usage_event_id = e.id
				where e.chat_id = ${chatId}::uuid
			`),
			this.db.execute<AiCallDbRow>(sql`
				select
					coalesce(r.id, e.id) as id,
					e.operation::text as operation,
					e.model,
					e.provider,
					case when r.id is null then e.input_tokens else null end as input_tokens,
					case when r.id is null then e.output_tokens else null end as output_tokens,
					case
						when r.id is not null then null
						when e.input_tokens is null and e.output_tokens is null then null
						else coalesce(e.input_tokens, 0) + coalesce(e.output_tokens, 0)
					end as total_tokens,
					case
						when r.id is null then coalesce(
							e.reconciled_cost_usd_micros,
							e.estimated_cost_usd_micros
						)
						else r.reconciled_cost_usd_micros
					end as cost_usd_micros,
					e.message_id,
					r.gateway_generation_id,
					r.step_usage,
					e.created_at
				from ai_usage_events e
				left join ai_usage_generation_refs r on r.usage_event_id = e.id
				where e.chat_id = ${chatId}::uuid
				order by e.created_at desc, e.id desc, r.id desc
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
					message_stats.last_message_at
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
		lastMessageAt:
			row.last_message_at === null ? null : toIso(row.last_message_at),
		createdAt: toIso(row.created_at),
		owner: mapOwner(row),
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
		totalTokens: isGenerationRef
			? generationUsage.totalTokens
			: row.total_tokens === null
				? null
				: toNumber(row.total_tokens),
		costUsd:
			row.cost_usd_micros === null
				? null
				: toNumber(row.cost_usd_micros) / 1_000_000,
		messageId: row.message_id,
		gatewayGenerationId: row.gateway_generation_id,
		createdAt: toIso(row.created_at),
	};
}

type RefTokenUsage = {
	inputTokens: number | null;
	outputTokens: number | null;
	totalTokens: number | null;
};

function tokenUsageFromStepUsage(value: unknown): RefTokenUsage {
	const root = isRecord(value) ? value : null;
	const usage = isRecord(root?.providerUsage) ? root.providerUsage : root;
	const inputTokens = tokenCount(usage?.inputTokens);
	const outputTokens = tokenCount(usage?.outputTokens);
	const explicitTotal = tokenCount(usage?.totalTokens);
	const totalTokens =
		explicitTotal ??
		(inputTokens === null && outputTokens === null
			? null
			: (inputTokens ?? 0) + (outputTokens ?? 0));

	return { inputTokens, outputTokens, totalTokens };
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
			'media',
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
		from media_generation_attempts a
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

		case "media":
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
						'kind', a.kind::text,
						'model', a.model,
						'quality', a.quality,
						'talking', a.talking,
						'title', a.title,
						'durationSeconds', a.duration_seconds,
						'startedAt', a.started_at,
						'completedAt', a.completed_at
					) as raw
				from media_generation_attempts a
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
		case "media":
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
