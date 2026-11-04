/**
 * Header-scoped sharing routes of one workspace: external collaborators and invite links.
 * The web People page calls them. They call WorkspacesService and InviteLinksService.
 * Owners and admins only: the guard checks `member:create`, which only those roles have.
 */
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateWorkspaceInviteLinkBody,
	createWorkspaceInviteLinkBodySchema,
	type ListWorkspaceCollaboratorsResponse,
	type ListWorkspaceInviteLinksResponse,
	uuidSchema,
	type WorkspaceInviteLink,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects";
import { OrganizationsEnabledGuard } from "../../../../settings";
import { InviteLinksService } from "../../../application/services/invite-links.service";
import { WorkspacesService } from "../../../application/services/workspaces.service";
import type { WorkspaceContext } from "../../../domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../decorators/workspace.decorators";

/** Routes under `/api/v1/workspace`. The own personal workspace gets its org id from `ensurePersonalWorkspace`. */
@Controller("v1/workspace")
@RequireWorkspacePermission("member", "create")
export class WorkspaceSharingController {
	constructor(
		@Inject(WorkspacesService)
		private readonly workspaces: WorkspacesService,
		@Inject(InviteLinksService)
		private readonly inviteLinks: InviteLinksService,
	) {}

	@Get("collaborators")
	async listCollaborators(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListWorkspaceCollaboratorsResponse> {
		return this.workspaces.listCollaborators({
			organizationId: await this.organizationIdOf(workspace, user.id),
			scope: projectScopeFrom(workspace, user.id),
		});
	}

	@Get("invite-links")
	async listInviteLinks(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListWorkspaceInviteLinksResponse> {
		return this.inviteLinks.listWorkspaceLinks(
			await this.organizationIdOf(workspace, user.id),
		);
	}

	// A new link is new collaboration, so the toggle stops it (workspaces-sharing.md 3.4).
	@UseGuards(OrganizationsEnabledGuard)
	@Post("invite-links")
	async createInviteLink(
		@Body(new ZodValidationPipe(createWorkspaceInviteLinkBodySchema))
		body: CreateWorkspaceInviteLinkBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<WorkspaceInviteLink> {
		return this.inviteLinks.createWorkspaceLink({
			createdByUserId: user.id,
			organizationId: await this.organizationIdOf(workspace, user.id),
			role: body.role,
		});
	}

	@Delete("invite-links/:linkId")
	@HttpCode(HttpStatus.NO_CONTENT)
	async revokeInviteLink(
		@Param("linkId", new ZodValidationPipe(uuidSchema)) linkId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<void> {
		await this.inviteLinks.revokeWorkspaceLink(
			await this.organizationIdOf(workspace, user.id),
			linkId,
		);
	}

	/** The organization id of the header workspace. The own personal workspace has one too. */
	private async organizationIdOf(
		workspace: WorkspaceContext,
		userId: string,
	): Promise<string> {
		return workspace.kind === "personal"
			? this.workspaces.ensurePersonalWorkspace(userId)
			: workspace.organizationId;
	}
}
