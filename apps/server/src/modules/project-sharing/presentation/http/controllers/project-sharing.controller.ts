/**
 * `/api/v2/projects/:projectId/...` sharing routes of the Share dialog and the settings panel.
 * The global ProjectAccessGuard resolves the caller's project role; the header role never decides.
 * They call ProjectSharingService and ProjectInvitationsService.
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
	Patch,
	Post,
	Put,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateProjectInvitationsBody,
	type CreateProjectInvitationsResponse,
	createProjectInvitationsBodySchema,
	type MoveProjectBody,
	moveProjectBodySchema,
	type ProjectInviteLink,
	type ProjectMember,
	type ProjectSharingState,
	type PutProjectInviteLinkBody,
	putProjectInviteLinkBodySchema,
	type TransferProjectBody,
	transferProjectBodySchema,
	type UpdateProjectMemberBody,
	type UpdateProjectWorkspaceAccessBody,
	updateProjectMemberBodySchema,
	updateProjectWorkspaceAccessBodySchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readClientIp } from "../../../../../infrastructure/http/client-ip";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { V2BuilderEnabledGuard } from "../../../../app-builder";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { OrganizationsEnabledGuard } from "../../../../settings";
import { ProjectInvitationsService } from "../../../application/services/project-invitations.service";
import {
	ProjectSharingService,
	type SharingActor,
} from "../../../application/services/project-sharing.service";

/**
 * Routes under `/api/v2/projects/:projectId`. Each route names its lowest project role.
 * The product setting `v2BuilderEnabled` closes them like every other V2 route. The resolved
 * project access replaces the per-user rollout flag, so invitees keep working.
 */
@Controller("v2/projects/:projectId")
@UseGuards(V2BuilderEnabledGuard)
export class ProjectSharingController {
	constructor(
		@Inject(ProjectSharingService)
		private readonly sharing: ProjectSharingService,
		@Inject(ProjectInvitationsService)
		private readonly invitations: ProjectInvitationsService,
	) {}

	@RequireProjectRole("viewer")
	@Get("sharing")
	getSharing(
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ProjectSharingState> {
		return this.sharing.getSharingState(access);
	}

	// An invitation is new collaboration, so the toggle stops it (workspaces-sharing.md 3.4).
	@UseGuards(OrganizationsEnabledGuard)
	@RequireProjectRole("editor")
	@Post("invitations")
	createInvitations(
		@Body(new ZodValidationPipe(createProjectInvitationsBodySchema))
		body: CreateProjectInvitationsBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<CreateProjectInvitationsResponse> {
		return this.invitations.create({ access, body, inviter: user });
	}

	@RequireProjectRole("editor")
	@Delete("invitations/:invitationId")
	@HttpCode(HttpStatus.NO_CONTENT)
	cancelInvitation(
		@Param("invitationId", new ZodValidationPipe(uuidSchema))
		invitationId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<void> {
		return this.invitations.cancel({
			access,
			actorUserId: user.id,
			invitationId,
		});
	}

	@RequireProjectRole("editor")
	@Patch("members/:userId")
	updateMember(
		@Param("userId") targetUserId: string,
		@Body(new ZodValidationPipe(updateProjectMemberBodySchema))
		body: UpdateProjectMemberBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<ProjectMember> {
		return this.sharing.updateMember({
			access,
			actor: actorOf(user, request),
			role: body.role,
			targetUserId,
		});
	}

	// Viewer on purpose: everyone may remove their own grant. The service checks the rest.
	@RequireProjectRole("viewer")
	@Delete("members/:userId")
	@HttpCode(HttpStatus.NO_CONTENT)
	removeMember(
		@Param("userId") targetUserId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<void> {
		return this.sharing.removeMember({
			access,
			actor: actorOf(user, request),
			targetUserId,
		});
	}

	@RequireProjectRole("editor")
	@Patch("workspace-access")
	updateWorkspaceAccess(
		@Body(new ZodValidationPipe(updateProjectWorkspaceAccessBodySchema))
		body: UpdateProjectWorkspaceAccessBody,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<UpdateProjectWorkspaceAccessBody> {
		return this.sharing.updateWorkspaceAccess(access, body.workspaceAccess);
	}

	// A new link is new collaboration, so the toggle stops it (workspaces-sharing.md 3.4).
	@UseGuards(OrganizationsEnabledGuard)
	@RequireProjectRole("editor")
	@Put("invite-link")
	putInviteLink(
		@Body(new ZodValidationPipe(putProjectInviteLinkBodySchema))
		body: PutProjectInviteLinkBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<ProjectInviteLink> {
		return this.sharing.putInviteLink({
			access,
			actor: actorOf(user, request),
			role: body.role,
		});
	}

	@RequireProjectRole("editor")
	@Delete("invite-link")
	@HttpCode(HttpStatus.NO_CONTENT)
	revokeInviteLink(
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<void> {
		return this.sharing.revokeInviteLink(access);
	}

	@RequireProjectRole("owner")
	@Post("transfer")
	@HttpCode(HttpStatus.NO_CONTENT)
	transfer(
		@Body(new ZodValidationPipe(transferProjectBodySchema))
		body: TransferProjectBody,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<void> {
		return this.sharing.transfer(access, body.newOwnerUserId);
	}

	// Owner is the floor; the service also needs the workspace owner of the source.
	@RequireProjectRole("owner")
	@Post("move")
	@HttpCode(HttpStatus.NO_CONTENT)
	move(
		@Body(new ZodValidationPipe(moveProjectBodySchema)) body: MoveProjectBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<void> {
		return this.sharing.move({ access, actor: actorOf(user, request), body });
	}
}

function actorOf(user: AuthUser, request: FastifyRequest): SharingActor {
	return { id: user.id, ipAddress: readClientIp(request) };
}
