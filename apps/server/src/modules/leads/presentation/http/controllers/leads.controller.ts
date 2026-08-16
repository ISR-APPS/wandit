// Workspace Leads tab endpoints. All behind the global AuthGuard; ownership
// is proven in repository joins.
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Patch,
	Query,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type LeadArchiveBody,
	type LeadResponse,
	type LeadStatusUpdateBody,
	type LeadsQuery,
	type LeadsResponse,
	leadArchiveBodySchema,
	leadStatusUpdateBodySchema,
	leadsQuerySchema,
	uuidSchema,
	type WorkspaceLeadsQuery,
	type WorkspaceLeadsResponse,
	workspaceLeadsQuerySchema,
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

	// Dashboard Leads page: one keyset page across every project the active
	// workspace can see. Scoping is entirely projectScopePredicate — no
	// project id in the path, optional project/source narrowing in the query.
	@Get("leads")
	listForWorkspace(
		@Query(new ZodValidationPipe(workspaceLeadsQuerySchema))
		query: WorkspaceLeadsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<WorkspaceLeadsResponse> {
		return this.leadsService.listForWorkspace(
			projectScopeFrom(workspace, user.id),
			query,
		);
	}

	// Stable keyset page, newest first. Search/status filtering and aggregate
	// counters are evaluated over the complete owned lead book in SQL.
	@Get("projects/:projectId/leads")
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query(new ZodValidationPipe(leadsQuerySchema)) query: LeadsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<LeadsResponse> {
		return this.leadsService.list(
			projectScopeFrom(workspace, user.id),
			projectId,
			query,
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

	@Patch("projects/:projectId/leads/:leadId/archive")
	archive(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("leadId", new ZodValidationPipe(uuidSchema))
		leadId: string,
		@Body(new ZodValidationPipe(leadArchiveBodySchema))
		body: LeadArchiveBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<LeadResponse> {
		return this.leadsService.archive(
			projectScopeFrom(workspace, user.id),
			projectId,
			leadId,
			body.archived,
		);
	}
}
