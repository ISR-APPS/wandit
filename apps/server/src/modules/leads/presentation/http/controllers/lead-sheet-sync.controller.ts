// Sheet-sync endpoints for the Leads tab: GET answers "is Google connected /
// which sheet", POST performs the full-rewrite sync. Behind the global
// AuthGuard; ownership is proven in the repository join. POST needs
// `project:update`, so a workspace Viewer cannot write the sheet.
import { Controller, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type LeadSheetSyncState, uuidSchema } from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { LeadSheetSyncService } from "../../../application/services/lead-sheet-sync.service";

@Controller("v1")
export class LeadSheetSyncController {
	constructor(
		@Inject(LeadSheetSyncService)
		private readonly leadSheetSyncService: LeadSheetSyncService,
	) {}

	@Get("projects/:projectId/leads/sheet-sync")
	state(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<LeadSheetSyncState> {
		return this.leadSheetSyncService.getState(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	// Sync is idempotent (full rewrite), so a repeat POST is safe — 200, not 201.
	@RequireWorkspacePermission("project", "update")
	@Post("projects/:projectId/leads/sheet-sync")
	@HttpCode(200)
	syncNow(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<LeadSheetSyncState> {
		return this.leadSheetSyncService.syncNow(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}
}
