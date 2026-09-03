import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateManualSubscriptionRequestBody,
	createManualSubscriptionRequestBodySchema,
	type ManualSubscriptionRequestViewResponse,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { ManualPaymentsEnabledGuard } from "../../../../settings";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { ManualSubscriptionRequestsService } from "../../../application/services/manual-subscription-requests.service";
import { WebOriginWriteGuard } from "../guards/web-origin-write.guard";

@Controller("v1/billing")
export class ManualBillingController {
	constructor(
		@Inject(ManualSubscriptionRequestsService)
		private readonly requestsService: ManualSubscriptionRequestsService,
	) {}

	@Get("manual-request")
	getCurrent(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ManualSubscriptionRequestViewResponse> {
		return this.requestsService.getCurrent(user, workspace);
	}

	@UseGuards(WebOriginWriteGuard, ManualPaymentsEnabledGuard)
	@RequireWorkspacePermission("billing", "manage")
	@Post("manual-request")
	create(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Body(new ZodValidationPipe(createManualSubscriptionRequestBodySchema))
		body: CreateManualSubscriptionRequestBody,
	): Promise<ManualSubscriptionRequestViewResponse> {
		return this.requestsService.create(user, body, workspace);
	}

	@UseGuards(WebOriginWriteGuard)
	@RequireWorkspacePermission("billing", "manage")
	@Post("manual-request/cancel")
	cancel(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ManualSubscriptionRequestViewResponse> {
		return this.requestsService.cancel(user, workspace);
	}
}
