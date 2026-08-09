// Worker database helper for chat generation.
//
// The API saves the user message. The worker later loads the chat history,
// calls the model, and saves the final assistant message.
//
// Assistant message ids are based on the job id, so retrying the same job
// updates the same assistant message instead of creating duplicates.
import { Inject, Injectable } from "@nestjs/common";
import type { ChatMessage } from "@wandit/contracts";
import { and, asc, eq, isNull } from "@wandit/db";
import { chats, messages } from "@wandit/db/schema/chats";
import { projects } from "@wandit/db/schema/projects";
import type { UIMessage } from "ai";

import {
	WORKER_DATABASE,
	type WorkerDatabase,
} from "../database/database.constants";

// Type of one row from the messages table.
export type WorkerMessageRow = typeof messages.$inferSelect;

// Data the processor needs before calling the AI model.
export type GenerationContext = {
	messages: UIMessage[];
	projectId: string;
	userId: string;
};

// `@Injectable()` lets the processor inject this repository.
@Injectable()
export class WorkerChatRepository {
	constructor(
		// `@Inject(WORKER_DATABASE)` asks Nest for the worker DB connection.
		@Inject(WORKER_DATABASE)
		private readonly db: WorkerDatabase,
	) {}

	// Load chat history for one queued generation job.
	async loadGenerationContext(input: {
		chatId: string;
		projectId: string;
		userId: string;
	}): Promise<GenerationContext> {
		// Verify the queued job points to a real chat owned by the expected user.
		const [chat] = await this.db
			.select({
				projectId: chats.projectId,
				userId: projects.userId,
			})
			.from(chats)
			.innerJoin(projects, eq(projects.id, chats.projectId))
			.where(
				and(
					eq(chats.id, input.chatId),
					eq(chats.projectId, input.projectId),
					eq(projects.userId, input.userId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		if (!chat) {
			throw new Error("Generation chat not found");
		}

		// Load messages in the same order the UI shows them.
		const rows = await this.db
			.select()
			.from(messages)
			.where(eq(messages.chatId, input.chatId))
			.orderBy(asc(messages.seq));

		return {
			messages: rows.map(toUiMessage),
			projectId: chat.projectId,
			userId: chat.userId,
		};
	}

	// Save the assistant message. Retry of the same job updates the same row.
	async insertAssistantMessage(input: {
		chatId: string;
		id: string;
		metadata: Record<string, unknown>;
		text: string;
	}): Promise<WorkerMessageRow> {
		// Messages use AI SDK "parts". This assistant message has one text part.
		const parts = [
			{
				state: "done",
				text: input.text,
				type: "text",
			},
		];
		// If the same id already exists, update it instead of inserting duplicate.
		const [row] = await this.db
			.insert(messages)
			.values({
				chatId: input.chatId,
				id: input.id,
				metadata: input.metadata,
				parts,
				role: "assistant",
			})
			.onConflictDoUpdate({
				set: {
					metadata: input.metadata,
					parts,
				},
				target: messages.id,
			})
			.returning();

		if (!row) {
			throw new Error("Assistant message write did not return a row");
		}

		return row;
	}

	/**
	 * Loads the deterministic assistant row used by a legacy generation job.
	 *
	 * A worker can crash after settling the usage event but before publishing the
	 * completion event. In that state the provider must not be called again; the
	 * already-saved assistant row is the durable replay source.
	 */
	async findAssistantMessageById(input: {
		chatId: string;
		id: string;
	}): Promise<WorkerMessageRow | null> {
		const [row] = await this.db
			.select()
			.from(messages)
			.where(
				and(
					eq(messages.id, input.id),
					eq(messages.chatId, input.chatId),
					eq(messages.role, "assistant"),
				),
			)
			.limit(1);

		return row ?? null;
	}
}

// Convert a DB row into the shared chat message shape.
export function toChatMessage(row: WorkerMessageRow): ChatMessage {
	return {
		chatId: row.chatId,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		metadata: isRecord(row.metadata) ? row.metadata : null,
		parts: Array.isArray(row.parts) ? (row.parts as ChatMessage["parts"]) : [],
		role: row.role,
		seq: row.seq,
	};
}

// Convert a DB row into the message shape expected by the AI SDK.
function toUiMessage(row: WorkerMessageRow): UIMessage {
	return {
		id: row.id,
		metadata: row.metadata ?? undefined,
		parts: Array.isArray(row.parts) ? (row.parts as UIMessage["parts"]) : [],
		role: row.role,
	};
}

// Runtime check for "plain object, not null, not array".
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
