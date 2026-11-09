/**
 * `GET /api/v2/projects/:projectId/messages`: one page of the stored chat,
 * the newest page first (WANDIT-204). It sits behind the global AuthGuard
 * and the `V2BuilderEnabledGuard`; the global ProjectAccessGuard checks the
 * project role. `ChatHistoryService` runs the scope check.
 */
import {
	Controller,
	Get,
	Inject,
	Param,
	Query,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type ChatHistoryPage,
	type ChatHistoryQuery,
	chatHistoryQuerySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { ChatHistoryService } from "../../../application/services/chat-history.service";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/** The history route of the V2 chat. */
@Controller("v2/projects/:projectId/messages")
@UseGuards(V2BuilderEnabledGuard)
export class ChatHistoryController {
	constructor(
		@Inject(ChatHistoryService)
		private readonly chatHistory: ChatHistoryService,
	) {}

	// A bad `cursor` or `limit` answers 400 from the pipe.
	@RequireProjectRole("viewer")
	@Get()
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query(new ZodValidationPipe(chatHistoryQuerySchema))
		query: ChatHistoryQuery,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ChatHistoryPage> {
		return this.chatHistory.list(
			projectScopeFromAccess(access, user.id),
			projectId,
			query,
		);
	}
}
