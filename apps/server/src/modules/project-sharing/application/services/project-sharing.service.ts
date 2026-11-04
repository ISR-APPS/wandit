/**
 * Project sharing of V2 app projects (workspaces-sharing.md 2.2 and 5): the Share dialog state,
 * direct grants, Workspace access, the project invite link, transfer, and move.
 * ProjectSharingController calls it. It writes through ProjectSharingRepository and InviteLinksRepository,
 * and reads through ProjectInvitationsRepository, WorkspaceMembersRepository, and SubscriptionsRepository.
 * It stops turns through MembershipCleanupService and finds the personal workspace through WorkspacesService.
 */
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { workspaceRoleHasPermission } from "@wandit/auth/permissions";
import {
	type MoveProjectBody,
	PERSONAL_WORKSPACE,
	type ProjectInviteLink,
	type ProjectInviteLinkRole,
	type ProjectMember,
	type ProjectMemberRole,
	type ProjectSharingState,
	type ProjectWorkspaceAccess,
	projectInviteLinkRoleSchema,
} from "@wandit/contracts";

import { resolveBillingPlan } from "../../../billing/application/services/resolve-billing-plan";
import { SubscriptionsRepository } from "../../../billing/infrastructure/persistence/subscriptions.repository";
import {
	projectRoleAtLeast,
	type ResolvedProjectAccess,
} from "../../../projects";
import {
	InviteLinksRepository,
	MembershipCleanupService,
	newInviteLinkToken,
	PROJECT_INVITE_LINK_TTL_MS,
	parseWorkspaceRoles,
	WorkspaceMembersRepository,
	WorkspaceNotSupportedError,
	WorkspacePermissionDeniedError,
	WorkspacesService,
} from "../../../workspaces";
import { ProjectMoveBlockedError } from "../../domain/errors/project-sharing.errors";
import {
	canManageGrant,
	canSetWorkspaceAccess,
	narrowsWorkspaceAccess,
	sharingStateFor,
} from "../../domain/sharing-rules";
import { ProjectInvitationsRepository } from "../../infrastructure/persistence/project-invitations.repository";
import {
	type ProjectOwnerColumns,
	ProjectSharingRepository,
} from "../../infrastructure/persistence/project-sharing.repository";

/** The signed-in user who acts on the project. */
export type SharingActor = {
	id: string;
	/** Client IP of the request, for the audit rows of canceled turns. */
	ipAddress: string;
};

/** Each method takes the access that ProjectAccessGuard resolved; it never reads the workspace header. */
@Injectable()
export class ProjectSharingService {
	constructor(
		@Inject(ProjectSharingRepository)
		private readonly sharing: ProjectSharingRepository,
		@Inject(ProjectInvitationsRepository)
		private readonly invitations: ProjectInvitationsRepository,
		@Inject(InviteLinksRepository)
		private readonly inviteLinks: InviteLinksRepository,
		@Inject(MembershipCleanupService)
		private readonly cleanup: MembershipCleanupService,
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
		@Inject(WorkspacesService)
		private readonly workspaces: WorkspacesService,
		@Inject(SubscriptionsRepository)
		private readonly subscriptions: SubscriptionsRepository,
	) {}

	/** The Share dialog state. A viewer gets no invitations and no link token. */
	async getSharingState(
		access: ResolvedProjectAccess,
	): Promise<ProjectSharingState> {
		const projectId = access.project.id;
		const now = new Date();
		const [owner, members, invitations, link] = await Promise.all([
			this.sharing.findPerson(access.project.userId),
			this.sharing.listMembers(projectId),
			this.invitations.listPending(projectId, now),
			this.inviteLinks.findActiveForProject(projectId, now),
		]);
		// Both rows have foreign keys from the project, so a miss is a data bug.
		if (!owner || !access.workspace) {
			throw new Error(
				`Sharing state of project ${projectId} has no owner or workspace row`,
			);
		}
		const linkRole = link
			? projectInviteLinkRoleSchema.safeParse(link.role)
			: null;

		return sharingStateFor(access.role, {
			invitations,
			inviteLink:
				link && linkRole?.success
					? {
							expiresAt: link.expiresAt.toISOString(),
							role: linkRole.data,
							token: link.token,
						}
					: null,
			members,
			owner,
			workspace: {
				id: access.workspace.id,
				kind: access.workspace.kind,
				name: access.workspace.name,
			},
			workspaceAccess: access.project.workspaceAccess,
		});
	}

	/**
	 * Changes the role of one direct grant (rules in 2.2). A lower role revokes
	 * the project link; a change to viewer also stops the user's turns.
	 */
	async updateMember(input: {
		access: ResolvedProjectAccess;
		actor: SharingActor;
		targetUserId: string;
		role: ProjectMemberRole;
	}): Promise<ProjectMember> {
		const projectId = input.access.project.id;
		const from = await this.sharing.findMemberRole(
			projectId,
			input.targetUserId,
		);
		if (from === null) {
			throw new NotFoundException();
		}
		this.assertCanManageGrant(input.access, input.actor, {
			from,
			targetUserId: input.targetUserId,
			to: input.role,
		});

		const member = await this.sharing.updateMemberRole(
			projectId,
			input.targetUserId,
			input.role,
		);
		if (!member) {
			throw new NotFoundException();
		}
		// A downgrade revokes the link and stops the turns of a user who can no longer edit.
		if (!projectRoleAtLeast(input.role, from)) {
			await this.afterGrantReduced({
				actor: input.actor,
				projectId,
				undo: async () => {
					await this.sharing.updateMemberRole(
						projectId,
						input.targetUserId,
						from,
					);
				},
				userId: input.targetUserId,
			});
		}
		return member;
	}

	/** Removes one direct grant. Everyone can remove their own grant (leave the project). */
	async removeMember(input: {
		access: ResolvedProjectAccess;
		actor: SharingActor;
		targetUserId: string;
	}): Promise<void> {
		const projectId = input.access.project.id;
		const from = await this.sharing.findMemberRole(
			projectId,
			input.targetUserId,
		);
		if (from === null) {
			throw new NotFoundException();
		}
		this.assertCanManageGrant(input.access, input.actor, {
			from,
			targetUserId: input.targetUserId,
			to: null,
		});

		const deleted = await this.sharing.deleteMember(
			projectId,
			input.targetUserId,
		);
		if (deleted) {
			await this.afterGrantReduced({
				actor: input.actor,
				projectId,
				undo: () => this.sharing.restoreMember(deleted),
				userId: input.targetUserId,
			});
		}
	}

	/**
	 * Sets Workspace access. Setting or clearing Restricted needs the owner.
	 * A narrower value also revokes the project link.
	 */
	async updateWorkspaceAccess(
		access: ResolvedProjectAccess,
		workspaceAccess: ProjectWorkspaceAccess,
	): Promise<{ workspaceAccess: ProjectWorkspaceAccess }> {
		if (
			!canSetWorkspaceAccess({
				actorRole: access.role,
				from: access.project.workspaceAccess,
				to: workspaceAccess,
			})
		) {
			throw new WorkspacePermissionDeniedError();
		}
		await this.sharing.updateWorkspaceAccess(
			access.project.id,
			workspaceAccess,
		);
		// Security: workspace members who lose access saw the link token, and the link gives
		// them a direct grant again.
		if (
			narrowsWorkspaceAccess(access.project.workspaceAccess, workspaceAccess)
		) {
			await this.inviteLinks.revokeProjectLink(access.project.id);
		}
		return { workspaceAccess };
	}

	/** Creates the project link and revokes the old one. A link never grants admin. */
	async putInviteLink(input: {
		access: ResolvedProjectAccess;
		actor: SharingActor;
		role: ProjectInviteLinkRole;
	}): Promise<ProjectInviteLink> {
		const row = await this.inviteLinks.replace({
			createdByUserId: input.actor.id,
			expiresAt: new Date(Date.now() + PROJECT_INVITE_LINK_TTL_MS),
			role: input.role,
			target: { kind: "project", projectId: input.access.project.id },
			token: newInviteLinkToken(),
		});
		return {
			expiresAt: row.expiresAt.toISOString(),
			role: input.role,
			token: row.token,
		};
	}

	async revokeInviteLink(access: ResolvedProjectAccess): Promise<void> {
		await this.inviteLinks.revokeProjectLink(access.project.id);
	}

	/**
	 * Gives a team project to another owner, admin, or editor of its workspace.
	 * A personal project always belongs to the personal owner, so it cannot transfer.
	 */
	async transfer(
		access: ResolvedProjectAccess,
		newOwnerUserId: string,
	): Promise<void> {
		const { organizationId, userId } = access.project;
		if (organizationId === null) {
			throw new WorkspaceNotSupportedError(
				"Only a team project can change its owner",
			);
		}
		if (newOwnerUserId === userId) {
			return;
		}

		const membership = await this.members.findMembership(
			organizationId,
			newOwnerUserId,
		);
		// A viewer cannot edit, so a viewer cannot own a project (rule 1 of 2.2).
		const roles = membership ? parseWorkspaceRoles(membership.role) : [];
		if (!roles.some((role) => role !== "viewer")) {
			throw new BadRequestException({
				code: "VALIDATION_ERROR",
				message:
					"The new owner must be an owner, admin, or editor of the workspace",
			});
		}

		const moved = await this.sharing.transferOwner({
			fromUserId: userId,
			organizationId,
			projectId: access.project.id,
			toUserId: newOwnerUserId,
		});
		if (!moved) {
			throw ownerChangedError();
		}
	}

	/**
	 * Moves the project to another workspace. Only the workspace owner of the
	 * source can move, into a workspace where the caller can create projects.
	 */
	async move(input: {
		access: ResolvedProjectAccess;
		actor: SharingActor;
		body: MoveProjectBody;
	}): Promise<void> {
		const { access, actor, body } = input;
		const source = access.project;
		// Team: the `owner` role. Personal: the personal owner, who is `projects.user_id`.
		const callerOwnsSourceWorkspace =
			source.organizationId === null
				? source.userId === actor.id
				: access.workspaceRoles.includes("owner");
		if (!callerOwnsSourceWorkspace) {
			throw new WorkspacePermissionDeniedError();
		}

		const destination = await this.destinationOf(
			body.destinationWorkspaceId,
			actor.id,
		);
		const sourceWorkspaceId = source.organizationId ?? access.workspace?.id;
		if (destination.organizationId === sourceWorkspaceId) {
			throw new WorkspaceNotSupportedError(
				"The project is already in this workspace",
			);
		}

		const result = await this.sharing.moveProject({
			destination: destination.ownerColumns,
			destinationPlan: await resolveBillingPlan(this.subscriptions, {
				actorUserId: destination.ownerColumns.userId,
				organizationId: destination.ownerColumns.organizationId,
			}),
			keepCollaborators: body.keepCollaborators,
			projectId: source.id,
			source: { organizationId: source.organizationId, userId: source.userId },
		});
		if (result.kind === "blocked") {
			throw new ProjectMoveBlockedError(result.reason);
		}
		if (result.kind === "changed") {
			throw ownerChangedError();
		}
	}

	/**
	 * The destination workspace org id and the owner columns of a project there.
	 * 404 when the caller is not a member; 403 when the caller cannot create projects there.
	 */
	private async destinationOf(
		destinationWorkspaceId: string,
		callerUserId: string,
	): Promise<{ organizationId: string; ownerColumns: ProjectOwnerColumns }> {
		if (destinationWorkspaceId === PERSONAL_WORKSPACE) {
			return {
				organizationId:
					await this.workspaces.ensurePersonalWorkspace(callerUserId),
				ownerColumns: { organizationId: null, userId: callerUserId },
			};
		}

		const membership = await this.members.findMembership(
			destinationWorkspaceId,
			callerUserId,
		);
		if (!membership) {
			throw new NotFoundException();
		}
		// The own personal workspace needs no role check: its owner may do everything.
		if (
			membership.personalOwnerUserId !== callerUserId &&
			!workspaceRoleHasPermission(membership.role, { project: ["create"] })
		) {
			throw new WorkspacePermissionDeniedError();
		}
		return {
			organizationId: membership.organizationId,
			// In a personal workspace the owner owns every project, also one that a member moves in.
			ownerColumns:
				membership.personalOwnerUserId === null
					? { organizationId: membership.organizationId, userId: callerUserId }
					: { organizationId: null, userId: membership.personalOwnerUserId },
		};
	}

	private assertCanManageGrant(
		access: ResolvedProjectAccess,
		actor: SharingActor,
		change: {
			targetUserId: string;
			from: ProjectMemberRole;
			to: ProjectMemberRole | null;
		},
	): void {
		if (
			!canManageGrant({
				...change,
				actorRole: access.role,
				actorUserId: actor.id,
			})
		) {
			throw new WorkspacePermissionDeniedError();
		}
	}

	/**
	 * A removed or lowered user may know the link token, so the link dies.
	 * A user without edit access also loses the turns that still run.
	 * A failed turn cancel undoes the grant change and rethrows, so a retry runs the cancel again.
	 */
	private async afterGrantReduced(input: {
		projectId: string;
		/** The user whose grant was removed or lowered. */
		userId: string;
		actor: SharingActor;
		/** Writes the grant back as it was before the request. */
		undo: () => Promise<void>;
	}): Promise<void> {
		await this.inviteLinks.revokeProjectLink(input.projectId);
		try {
			await this.cleanup.cancelProjectTurnsWithoutEditAccess({
				actorUserId: input.actor.id,
				ipAddress: input.actor.ipAddress,
				projectId: input.projectId,
				userId: input.userId,
			});
		} catch (error) {
			// Without the undo, a retry finds no grant or no downgrade and skips the cancel.
			// A `waiting` turn would then start later.
			await input.undo();
			throw error;
		}
	}
}

function ownerChangedError(): ConflictException {
	return new ConflictException({
		code: "VERSION_CONFLICT",
		message: "The project owner changed. Reload and try again.",
	});
}
