// HTTP endpoint for the chat's connector-generation card: one ownership-
// checked status read, behind the global AuthGuard.
import { Controller, Get, Inject, Param } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type ConnectorGenerationAttempt, uuidSchema } from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
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
	): Promise<ConnectorGenerationAttempt> {
		return this.connectorGenerationsService.attempt(user.id, attemptId);
	}
}
