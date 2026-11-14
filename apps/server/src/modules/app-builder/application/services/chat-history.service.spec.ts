import { randomUUID } from "node:crypto";
import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import {
	type ProjectScope,
	projectScopeFrom,
} from "../../../projects/domain/project-scope";
import type { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import type { BuilderTurnsRepository } from "../../infrastructure/persistence/builder-turns.repository";
import { ChatHistoryService } from "./chat-history.service";

const SCOPE: ProjectScope = projectScopeFrom(undefined, "user-1");

describe("ChatHistoryService.list", () => {
	// Security: the caller can read the chat, but the route names another project.
	it("404s on a chatId of another project and reads no message", async () => {
		const chatId = randomUUID();
		const chats = {
			findAccessibleChatById: vi.fn<ChatsRepository["findAccessibleChatById"]>(
				async () => ({ id: chatId, projectId: "project-2", userId: "user-1" }),
			),
			findAccessibleChatByProjectId: vi.fn<
				ChatsRepository["findAccessibleChatByProjectId"]
			>(async () => null),
			listHistoryRows: vi.fn<ChatsRepository["listHistoryRows"]>(
				async () => [],
			),
		};
		const service = new ChatHistoryService(
			{
				findEngineByIdForScope: vi.fn<
					ProjectsRepository["findEngineByIdForScope"]
				>(async () => "v2_app"),
			},
			chats,
			{
				findActiveForChat: vi.fn<BuilderTurnsRepository["findActiveForChat"]>(
					async () => [],
				),
			},
		);

		await expect(
			service.list(SCOPE, "project-1", { chatId, limit: 30 }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(chats.listHistoryRows).not.toHaveBeenCalled();
	});
});
