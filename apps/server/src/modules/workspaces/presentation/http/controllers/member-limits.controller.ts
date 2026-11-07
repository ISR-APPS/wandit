/**
 * HTTP routes of the member credit limits of the header workspace.
 * The web settings page calls them. They call MemberLimitsService.
 * A team workspace and the caller's own personal workspace are allowed.
 */
import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type PutWorkspaceMemberLimitsBody,
	putWorkspaceMemberLimitsBodySchema,
	type WorkspaceMemberLimitsResponse,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth/presentation/http/decorators/current-user.decorator";
import {
	type LimitsWorkspace,
	MemberLimitsService,
} from "../../../application/services/member-limits.service";
import { WorkspacesService } from "../../../application/services/workspaces.service";
import { WorkspacePermissionDeniedError } from "../../../domain/errors/workspace.errors";
import type { WorkspaceContext } from "../../../domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../decorators/workspace.decorators";

// Header-scoped (no org URL param, teams-workspaces.md §2). The guard denies
// `limits` in a shared personal workspace: only its owner manages its limits.
@Controller("v1/workspace/member-limits")
@RequireWorkspacePermission("limits", "manage")
export class MemberLimitsController {
	constructor(
		@Inject(MemberLimitsService)
		private readonly memberLimitsService: MemberLimitsService,
		@Inject(WorkspacesService)
		private readonly workspacesService: WorkspacesService,
	) {}

	@Get()
	async get(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<WorkspaceMemberLimitsResponse> {
		return this.memberLimitsService.get(
			await this.limitsWorkspace(user.id, workspace),
		);
	}

	@Put()
	async update(
		@Body(new ZodValidationPipe(putWorkspaceMemberLimitsBodySchema))
		body: PutWorkspaceMemberLimitsBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<WorkspaceMemberLimitsResponse> {
		return this.memberLimitsService.update(
			await this.limitsWorkspace(user.id, workspace),
			body,
			user.id,
		);
	}

	private async limitsWorkspace(
		userId: string,
		workspace: WorkspaceContext,
	): Promise<LimitsWorkspace> {
		switch (workspace.kind) {
			case "personal":
				// Limit rows key on the org id, so the personal org must exist.
				return {
					organizationId:
						await this.workspacesService.ensurePersonalWorkspace(userId),
					personalOwnerUserId: userId,
				};
			case "shared-personal":
				// The guard already denies this. This check stays if the guard is not registered.
				throw new WorkspacePermissionDeniedError();
			case "org":
				return {
					organizationId: workspace.organizationId,
					personalOwnerUserId: null,
				};
		}
	}
}
