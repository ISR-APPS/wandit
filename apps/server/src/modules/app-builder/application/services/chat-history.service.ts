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
		// The Pick types, not the classes: a spec passes fakes without a cast.
		@Inject(ProjectsRepository)
		private readonly projects: Pick<
			ProjectsRepository,
			"findEngineByIdForScope"
		>,
		@Inject(ChatsRepository)
		private readonly chats: Pick<
			ChatsRepository,
			| "findAccessibleChatById"
			| "findAccessibleChatByProjectId"
			| "listHistoryRows"
		>,
		@Inject(BuilderTurnsRepository)
		private readonly turns: Pick<BuilderTurnsRepository, "findActiveForChat">,
	) {}

	/**
	 * One page of one conversation, the newest page first. `query.chatId`
	 * selects the conversation; absent reads the oldest one of the project.
	 * Answers 404 when the project is not a `v2_app` row in the scope, has
	 * no chat, or does not own `query.chatId`.
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
		// Security check, the same as `TurnsService.create`: a picked chat must
		// be in scope and belong to this project. A foreign chat id answers 404.
		const chat =
			query.chatId === undefined
				? await this.chats.findAccessibleChatByProjectId(scope, projectId)
				: await this.chats.findAccessibleChatById(scope, query.chatId);
		if (!chat || chat.projectId !== projectId) {
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
