/**
 * Database helper for chats and messages.
 *
 * Repository means: keep SQL/database details here, not inside services.
 *
 * This file is API-side only. The worker has its own repository for writing the
 * final assistant message.
 */
// `@Injectable()` lets Nest create and inject this repository.
import { Inject, Injectable } from "@nestjs/common";
import type { ChatUsageResponse, ComposerMetadata } from "@wandit/contracts";
// Drizzle is the TypeScript SQL builder/ORM used in this project.
import { and, asc, eq, isNull, sql } from "@wandit/db";
import { chats, messages } from "@wandit/db/schema/chats";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";

// Small shape returned after access checks. userId is the project creator
// (provenance) — in org scope it may differ from the acting member.
export type OwnedChatRow = {
	id: string;
	projectId: string;
	userId: string;
};

// Type of one row from the messages table.
export type InsertedMessageRow = typeof messages.$inferSelect;

type UiMessageToInsert = {
	id: string;
	metadata?: unknown;
	parts: unknown[];
	role: "user" | "assistant";
};

export type MessageFailureColumns = {
	failureKind: string | null;
	failureProvider: string | null;
	failureProviderMessage: string | null;
	failureRequestId: string | null;
	failureSource: string | null;
	sentryEventId: string | null;
};

type ChatUsageDbRow = {
	cache_read_tokens: number | string | null;
	cache_write_tokens: number | string | null;
	cost_usd_micros: number | string | null;
	credits_centi: number | string | null;
	input_tokens: number | string | null;
	output_tokens: number | string | null;
};

@Injectable()
// Database adapter around the chats/messages tables.
export class ChatsRepository {
	// DATABASE is the Nest token for the Drizzle database connection.
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	// Find a chat only if its project is accessible in this workspace scope.
	async findAccessibleChatById(
		scope: ProjectScope,
		chatId: string,
	): Promise<OwnedChatRow | null> {
		// chats -> projects -> scope predicate. This join proves access.
		const [row] = await this.db
			.select({
				id: chats.id,
				projectId: chats.projectId,
				userId: projects.userId,
			})
			.from(chats)
			.innerJoin(projects, eq(projects.id, chats.projectId))
			.where(
				and(
					eq(chats.id, chatId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		// Drizzle returns an array. No row means null.
		return row ?? null;
	}

	// Find the first chat for a project accessible in this workspace scope.
	async findAccessibleChatByProjectId(
		scope: ProjectScope,
		projectId: string,
	): Promise<OwnedChatRow | null> {
		// projectId is not unique, so choose the oldest chat if there are many.
		const [row] = await this.db
			.select({
				id: chats.id,
				projectId: chats.projectId,
				userId: projects.userId,
			})
			.from(chats)
			.innerJoin(projects, eq(projects.id, chats.projectId))
			.where(
				and(
					eq(chats.projectId, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.orderBy(asc(chats.createdAt))
			.limit(1);

		return row ?? null;
	}

	// Return chat messages in insertion order.
	listMessages(chatId: string): Promise<InsertedMessageRow[]> {
		return this.db
			.select()
			.from(messages)
			.where(eq(messages.chatId, chatId))
			.orderBy(asc(messages.seq));
	}

	async getUsage(chatId: string): Promise<ChatUsageResponse> {
		const result = await this.db.execute<ChatUsageDbRow>(sql`
			select
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
		`);
		const row = result.rows[0];

		return {
			inputTokens: toNullableNumber(row?.input_tokens),
			outputTokens: toNullableNumber(row?.output_tokens),
			cacheReadTokens: toNullableNumber(row?.cache_read_tokens),
			cacheWriteTokens: toNullableNumber(row?.cache_write_tokens),
			costUsdMicros: toNullableNumber(row?.cost_usd_micros),
			creditsCenti: toNullableNumber(row?.credits_centi),
		};
	}

	// Ids of already-persisted messages: server-hydrated history, as opposed
	// to new content the current request is submitting for the first time.
	async listMessageIds(chatId: string): Promise<Set<string>> {
		const rows = await this.db
			.select({ id: messages.id })
			.from(messages)
			.where(eq(messages.chatId, chatId));

		return new Set(rows.map((row) => row.id));
	}

	// Save the user's prompt before queueing the worker job.
	async insertUserMessage(input: {
		chatId: string;
		composer?: ComposerMetadata;
		text: string;
	}): Promise<InsertedMessageRow> {
		// Messages use AI SDK "parts". For now this user message has one text part.
		const [row] = await this.db
			.insert(messages)
			.values({
				chatId: input.chatId,
				metadata: input.composer ?? null,
				parts: [
					{
						state: "done",
						text: input.text,
						type: "text",
					},
				],
				role: "user",
			})
			.returning();

		// The caller needs the message id for the queue job.
		return this.expectMessage(row);
	}

	// Insert complete UI messages without changing rows already in history.
	async insertUiMessagesIfAbsent(
		chatId: string,
		inputMessages: readonly UiMessageToInsert[],
		assistantFailure: MessageFailureColumns | null,
	): Promise<void> {
		if (inputMessages.length === 0) {
			return;
		}

		await this.db
			.insert(messages)
			.values(
				inputMessages.map((message) => {
					const failure =
						message.role === "assistant" && assistantFailure
							? assistantFailure
							: EMPTY_FAILURE_COLUMNS;

					return {
						chatId,
						...failure,
						id: message.id,
						metadata: message.metadata ?? null,
						parts: message.parts,
						role: message.role,
					};
				}),
			)
			.onConflictDoNothing({ target: messages.id });
	}

	// Write a UI message even when a row with the same id already exists.
	// Needed for tray answers: the AI SDK CONTINUES the previous assistant
	// message (same id, old parts + the answer + everything after it), so the
	// insert-if-absent above would hit the id conflict and silently drop the
	// whole continuation. Here the conflict REPLACES parts/metadata instead —
	// "excluded" is Postgres for "the row we just tried to insert".
	async upsertUiMessage(
		chatId: string,
		message: UiMessageToInsert,
		assistantFailure: MessageFailureColumns | null,
	): Promise<void> {
		const failure =
			message.role === "assistant" && assistantFailure
				? assistantFailure
				: EMPTY_FAILURE_COLUMNS;

		await this.db
			.insert(messages)
			.values({
				chatId,
				...failure,
				id: message.id,
				metadata: message.metadata ?? null,
				parts: message.parts,
				role: message.role,
			})
			.onConflictDoUpdate({
				set: {
					failureKind: sql`excluded.failure_kind`,
					failureProvider: sql`excluded.failure_provider`,
					failureProviderMessage: sql`excluded.failure_provider_message`,
					failureRequestId: sql`excluded.failure_request_id`,
					failureSource: sql`excluded.failure_source`,
					metadata: sql`excluded.metadata`,
					parts: sql`excluded.parts`,
					sentryEventId: sql`excluded.sentry_event_id`,
				},
				target: messages.id,
			});
	}

	// Retry may remove only the failed assistant row it is replacing. The
	// message id, chat id, role, and terminal turn-error precondition are all
	// checked by the same DELETE statement, so a stale or cross-chat id is safe.
	async deleteTerminalFailedAssistantMessage(
		chatId: string,
		messageId: string,
	): Promise<boolean> {
		const deleted = await this.db
			.delete(messages)
			.where(
				and(
					eq(messages.id, messageId),
					eq(messages.chatId, chatId),
					eq(messages.role, "assistant"),
					sql`EXISTS (
						SELECT 1
						FROM jsonb_array_elements(
							CASE
								WHEN jsonb_typeof(${messages.parts}) = 'array'
								THEN ${messages.parts}
								ELSE '[]'::jsonb
							END
						) AS part
						WHERE part ->> 'type' = 'data-ai-error'
							AND part #>> '{data,terminal}' = 'true'
							AND part #>> '{data,toolCallId}' IS NULL
					)`,
				),
			)
			.returning({ id: messages.id });

		return deleted.length > 0;
	}

	// Cleanup used if saving succeeded but queueing failed.
	async deleteMessageById(messageId: string): Promise<void> {
		await this.db.delete(messages).where(eq(messages.id, messageId));
	}

	// Defensive guard: insert should always return one row.
	private expectMessage(row: InsertedMessageRow | undefined) {
		if (!row) {
			throw new Error("Message write did not return a row");
		}

		return row;
	}
}

const EMPTY_FAILURE_COLUMNS: MessageFailureColumns = {
	failureKind: null,
	failureProvider: null,
	failureProviderMessage: null,
	failureRequestId: null,
	failureSource: null,
	sentryEventId: null,
};

function toNullableNumber(
	value: number | string | null | undefined,
): number | null {
	return value === null || value === undefined ? null : Number(value);
}
