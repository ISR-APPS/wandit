import { Inject, Injectable } from "@nestjs/common";
import type { ComposerMetadata } from "@wandit/contracts";
import { and, asc, eq, isNull } from "@wandit/db";
import { chats, messages } from "@wandit/db/schema/chats";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type OwnedChatRow = {
	id: string;
	projectId: string;
	userId: string;
};

export type InsertedMessageRow = typeof messages.$inferSelect;

@Injectable()
export class ChatsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findOwnedChatById(
		userId: string,
		chatId: string,
	): Promise<OwnedChatRow | null> {
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

		return row ?? null;
	}

	async findOwnedChatByProjectId(
		userId: string,
		projectId: string,
	): Promise<OwnedChatRow | null> {
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

	listMessages(chatId: string): Promise<InsertedMessageRow[]> {
		return this.db
			.select()
			.from(messages)
			.where(eq(messages.chatId, chatId))
			.orderBy(asc(messages.seq));
	}

	async insertUserMessage(input: {
		chatId: string;
		composer?: ComposerMetadata;
		text: string;
	}): Promise<InsertedMessageRow> {
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

		return this.expectMessage(row);
	}

	async deleteMessageById(messageId: string): Promise<void> {
		await this.db.delete(messages).where(eq(messages.id, messageId));
	}

	private expectMessage(row: InsertedMessageRow | undefined) {
		if (!row) {
			throw new Error("Message write did not return a row");
		}

		return row;
	}
}
