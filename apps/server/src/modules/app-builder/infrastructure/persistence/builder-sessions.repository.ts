/**
 * Repository for the `builder_sessions` table: one row per chat holding the
 * harness resume state. `turns.service.ts` creates the row at first submit;
 * the `builder-turn` task (WANDIT-166) reads it at start and writes the new
 * resume state after each turn.
 */
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@wandit/db";
import { builderSessions } from "@wandit/db/schema/builder-sessions";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type {
	HarnessKind,
	HarnessResumeState,
} from "../../domain/ports/builder-harness";

/** One `builder_sessions` row. */
export type BuilderSessionRow = typeof builderSessions.$inferSelect;

@Injectable()
export class BuilderSessionsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The session row of a chat, or null before the first turn. */
	async findByChatId(chatId: string): Promise<BuilderSessionRow | null> {
		const [row] = await this.db
			.select()
			.from(builderSessions)
			.where(eq(builderSessions.chatId, chatId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Creates the session row for a chat. The `builder_sessions_chatId_uq`
	 * index keeps a raced double-create safe — the caller treats a conflict
	 * as "already exists" and re-reads.
	 */
	async create(input: {
		chatId: string;
		harness: HarnessKind;
		/** Model id the session starts on; null until decided. */
		model: string | null;
		organizationId: string | null;
		projectId: string;
		/** App template version at session start; null until the task knows it. */
		templateVersion: string | null;
		userId: string;
	}): Promise<BuilderSessionRow> {
		const [row] = await this.db
			.insert(builderSessions)
			.values({
				chatId: input.chatId,
				harness: input.harness,
				model: input.model,
				organizationId: input.organizationId,
				projectId: input.projectId,
				templateVersion: input.templateVersion,
				userId: input.userId,
			})
			.returning();

		if (!row) {
			throw new Error("Builder session insert did not return a row");
		}

		return row;
	}

	/**
	 * Stores the harness state a finished turn detached. The next turn of the
	 * chat reads it back through `findByChatId`. Returns the updated row, or
	 * null when the session row vanished (deleted chat).
	 */
	async saveResumeState(
		chatId: string,
		input: {
			model: string | null;
			providerSessionId: string | null;
			resumeState: HarnessResumeState;
		},
	): Promise<BuilderSessionRow | null> {
		const [row] = await this.db
			.update(builderSessions)
			.set({
				model: input.model,
				providerSessionId: input.providerSessionId,
				resumeState: input.resumeState,
			})
			.where(eq(builderSessions.chatId, chatId))
			.returning();

		return row ?? null;
	}
}
