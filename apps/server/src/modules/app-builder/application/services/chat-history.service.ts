/**
 * Reads the stored chat of a V2 project one page at a time (WANDIT-204).
 * Called by `ChatHistoryController`. Reads the project engine, the chat,
 * the active turns, and one page of `messages` through the repositories.
 */
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ChatHistoryPage, ChatHistoryQuery } from "@wandit/contracts";

import { mapMessageRow } from "../../../generation/infrastructure/mappers/chat-message.mapper";
import { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import { toChatHistoryPage } from "../../domain/chat-history";
import { BuilderTurnsRepository } from "../../infrastructure/persistence/builder-turns.repository";

/** The paged history read of the V2 chat. */
@Injectable()
export class ChatHistoryService {
	constructor(
		@Inject(ProjectsRepository)
		private readonly projects: ProjectsRepository,
		@Inject(ChatsRepository)
		private readonly chats: ChatsRepository,
		@Inject(BuilderTurnsRepository)
		private readonly turns: BuilderTurnsRepository,
	) {}

	/**
	 * One page of the project chat, the newest page first. Answers 404 when
	 * the project is not a `v2_app` row in the scope, or has no chat.
	 */
	async list(
		scope: ProjectScope,
		projectId: string,
		query: ChatHistoryQuery,
	): Promise<ChatHistoryPage> {
		const engine = await this.projects.findEngineByIdForScope(scope, projectId);
		if (engine !== "v2_app") {
			throw new NotFoundException();
		}
		const chat = await this.chats.findAccessibleChatByProjectId(
			scope,
			projectId,
		);
		if (!chat) {
			throw new NotFoundException();
		}

		// D20: the history hides the answer of a turn that still streams.
		const activeTurns = await this.turns.findActiveForChat(chat.id);
		const rows = await this.chats.listHistoryRows(chat.id, {
			beforeSeq: query.cursor,
			hiddenTurnIds: activeTurns.map((turn) => turn.id),
			limit: query.limit,
		});
		const page = toChatHistoryPage(rows, query.limit);

		return {
			items: page.items.map(mapMessageRow),
			nextCursor: page.nextCursor,
		};
	}
}
