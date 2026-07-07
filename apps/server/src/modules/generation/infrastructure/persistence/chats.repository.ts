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
import type { ComposerMetadata } from "@wandit/contracts";
// Drizzle is the TypeScript SQL builder/ORM used in this project.
import { and, asc, eq, isNull } from "@wandit/db";
import { chats, messages } from "@wandit/db/schema/chats";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

// Small shape returned after ownership checks.
export type OwnedChatRow = {
	id: string;
	projectId: string;
	userId: string;
};

// Type of one row from the messages table.
export type InsertedMessageRow = typeof messages.$inferSelect;

@Injectable()
// Database adapter around the chats/messages tables.
export class ChatsRepository {
	// DATABASE is the Nest token for the Drizzle database connection.
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	// Find a chat only if it belongs to this user.
	async findOwnedChatById(
		userId: string,
		chatId: string,
	): Promise<OwnedChatRow | null> {
		// chats -> projects -> userId. This join proves ownership.
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
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		// Drizzle returns an array. No row means null.
		return row ?? null;
	}

	// Find the first chat for a project owned by this user.
	async findOwnedChatByProjectId(
		userId: string,
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
					eq(projects.userId, userId),
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
