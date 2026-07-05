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

export type WorkerMessageRow = typeof messages.$inferSelect;

export type GenerationContext = {
	messages: UIMessage[];
	projectId: string;
	userId: string;
};

@Injectable()
export class WorkerChatRepository {
	constructor(
		@Inject(WORKER_DATABASE)
		private readonly db: WorkerDatabase,
	) {}

	async loadGenerationContext(input: {
		chatId: string;
		projectId: string;
		userId: string;
	}): Promise<GenerationContext> {
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

	async insertAssistantMessage(input: {
		chatId: string;
		id: string;
		metadata: Record<string, unknown>;
		text: string;
	}): Promise<WorkerMessageRow> {
		const parts = [
			{
				state: "done",
				text: input.text,
				type: "text",
			},
		];
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
}

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

function toUiMessage(row: WorkerMessageRow): UIMessage {
	return {
		id: row.id,
		metadata: row.metadata ?? undefined,
		parts: Array.isArray(row.parts) ? (row.parts as UIMessage["parts"]) : [],
		role: row.role,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
