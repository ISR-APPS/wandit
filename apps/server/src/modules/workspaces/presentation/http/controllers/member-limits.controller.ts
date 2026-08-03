import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type PutWorkspaceMemberLimitsBody,
	putWorkspaceMemberLimitsBodySchema,
	type WorkspaceMemberLimitsResponse,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth/presentation/http/decorators/current-user.decorator";
import { MemberLimitsService } from "../../../application/services/member-limits.service";
import type { WorkspaceContext } from "../../../domain/workspace-context";
import {
	CurrentWorkspace,
	RequireOrgWorkspace,
	RequireWorkspacePermission,
} from "../decorators/workspace.decorators";

// Header-scoped (no org URL param — teams-workspaces.md §2). Org-only:
// personal workspaces have no members to limit.
@Controller("v1/workspace/member-limits")
@RequireOrgWorkspace()
@RequireWorkspacePermission("limits", "manage")
export class MemberLimitsController {
	constructor(
		@Inject(MemberLimitsService)
		private readonly memberLimitsService: MemberLimitsService,
	) {}

	@Get()
	get(
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<WorkspaceMemberLimitsResponse> {
		return this.memberLimitsService.get(this.organizationId(workspace));
	}

	@Put()
	update(
		@Body(new ZodValidationPipe(putWorkspaceMemberLimitsBodySchema))
		body: PutWorkspaceMemberLimitsBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<WorkspaceMemberLimitsResponse> {
		return this.memberLimitsService.update(
			this.organizationId(workspace),
			body,
			user.id,
		);
	}

	private organizationId(workspace: WorkspaceContext): string {
		if (workspace.kind !== "org") {
			// RequireOrgWorkspace already rejected personal scope; this guards
			// against guard mis-registration ever exposing the route unscoped.
			throw new Error("Member limits require an org workspace context");
		}

		return workspace.organizationId;
	}
}
