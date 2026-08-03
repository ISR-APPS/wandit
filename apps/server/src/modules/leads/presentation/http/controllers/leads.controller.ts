// Workspace Leads tab endpoints. All behind the global AuthGuard; ownership
// is proven in repository joins.
import { Body, Controller, Get, Inject, Param, Patch } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type LeadResponse,
	type LeadStatusUpdateBody,
	type LeadsResponse,
	leadStatusUpdateBodySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { LeadsService } from "../../../application/services/leads.service";

@Controller("v1")
export class LeadsController {
	constructor(
		@Inject(LeadsService)
		private readonly leadsService: LeadsService,
	) {}

	// Full list, newest first — the tab filters/paginates client-side.
	@Get("projects/:projectId/leads")
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<LeadsResponse> {
		return this.leadsService.list(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@Patch("projects/:projectId/leads/:leadId/status")
	updateStatus(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("leadId", new ZodValidationPipe(uuidSchema))
		leadId: string,
		@Body(new ZodValidationPipe(leadStatusUpdateBodySchema))
		body: LeadStatusUpdateBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<LeadResponse> {
		return this.leadsService.updateStatus(
			projectScopeFrom(workspace, user.id),
			projectId,
			leadId,
			body.status,
		);
	}
}
