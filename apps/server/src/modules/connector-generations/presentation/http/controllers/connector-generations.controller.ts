// HTTP endpoint for the chat's connector-generation card: one scope-checked
// status read, behind the global AuthGuard. Workspace-scoped like the other
// generation readers: in a shared org chat any member may poll a card that a
// different member's turn queued.
import { Controller, Get, Inject, Param } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type ConnectorGenerationAttempt, uuidSchema } from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { ConnectorGenerationsService } from "../../../application/services/connector-generations.service";

@Controller("v1/connector-generations")
export class ConnectorGenerationsController {
	constructor(
		@Inject(ConnectorGenerationsService)
		private readonly connectorGenerationsService: ConnectorGenerationsService,
	) {}

	// Read by the chat card when the Realtime run settles (or while polling
	// as a fallback for old messages / dead subscriptions).
	@Get(":attemptId")
	attempt(
		@Param("attemptId", new ZodValidationPipe(uuidSchema))
		attemptId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ConnectorGenerationAttempt> {
		return this.connectorGenerationsService.attempt(
			projectScopeFrom(workspace, user.id),
			attemptId,
		);
	}
}
