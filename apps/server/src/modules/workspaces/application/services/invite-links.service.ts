/**
 * Workspace invite links (create, list, revoke) and the join flow of every link (preview, accept).
 * WorkspaceSharingController and InviteLinksController call it.
 * It reads and writes through InviteLinksRepository, WorkspaceMembersRepository, and ProjectGrantsRepository.
 * It reads the caller's project role through ProjectAccessService.
 */
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	type AcceptInviteLinkResponse,
	type InviteLinkPreview,
	type ListWorkspaceInviteLinksResponse,
	type ProjectInviteLinkRole,
	projectInviteLinkRoleSchema,
	type WorkspaceInviteLink,
	type WorkspaceInviteLinkRole,
	workspaceInviteLinkRoleSchema,
} from "@wandit/contracts";

import { ProjectAccessService } from "../../../projects";
import {
	EmailNotVerifiedError,
	InviteLinkInvalidError,
} from "../../domain/errors/workspace.errors";
import {
	type InviteLinkAcceptTarget,
	inviteLinkAcceptOutcome,
	newInviteLinkToken,
	WORKSPACE_INVITE_LINK_TTL_MS,
} from "../../domain/invite-links";
import {
	type InviteLinkRow,
	InviteLinksRepository,
	type InviteLinkWithFacts,
} from "../../infrastructure/persistence/invite-links.repository";
import { WorkspaceMembersRepository } from "../../infrastructure/persistence/members.repository";
import { ProjectGrantsRepository } from "../../infrastructure/persistence/project-grants.repository";

/** The signed-in user who opens or accepts a link. */
export type InviteLinkCaller = {
	id: string;
	/** Better Auth `user.emailVerified`. A link joins only a verified account. */
	emailVerified: boolean;
};

/** A link row with a known target and a parsed role. Null facts mean an invalid link. */
type ParsedInviteLink =
	| {
			kind: "workspace";
			organizationId: string;
			workspaceName: string;
			role: WorkspaceInviteLinkRole;
	  }
	| {
			kind: "project";
			projectId: string;
			projectName: string;
			role: ProjectInviteLinkRole;
			/** False for a deleted project or an engine other than `v2_app`. */
			projectIsLiveV2: boolean;
	  };

/** Project links are created by ProjectSharingService; this service only joins through them. */
@Injectable()
export class InviteLinksService {
	constructor(
		@Inject(InviteLinksRepository)
		private readonly links: InviteLinksRepository,
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
		@Inject(ProjectGrantsRepository)
		private readonly grants: ProjectGrantsRepository,
		@Inject(ProjectAccessService)
		private readonly projectAccess: ProjectAccessService,
	) {}

	/** The active links of one workspace. The controller allows owners and admins only. */
	async listWorkspaceLinks(
		organizationId: string,
	): Promise<ListWorkspaceInviteLinksResponse> {
		const rows = await this.links.listActiveForOrganization(
			organizationId,
			new Date(),
		);
		return {
			links: rows.flatMap((row) => {
				const link = toWorkspaceInviteLink(row);
				return link ? [link] : [];
			}),
		};
	}

	/** Creates a link of one role and revokes the old link of that role. */
	async createWorkspaceLink(input: {
		organizationId: string;
		role: WorkspaceInviteLinkRole;
		createdByUserId: string;
	}): Promise<WorkspaceInviteLink> {
		const row = await this.links.replace({
			createdByUserId: input.createdByUserId,
			expiresAt: new Date(Date.now() + WORKSPACE_INVITE_LINK_TTL_MS),
			role: input.role,
			target: { kind: "workspace", organizationId: input.organizationId },
			token: newInviteLinkToken(),
		});
		return { ...rowDates(row), role: input.role };
	}

	/** Revokes one link of this workspace. 404 when the workspace has no such active link. */
	async revokeWorkspaceLink(
		organizationId: string,
		linkId: string,
	): Promise<void> {
		if (!(await this.links.revokeWorkspaceLink(organizationId, linkId))) {
			throw new NotFoundException();
		}
	}

	/** The join page preview. An expired link answers `expired: true`; other bad links answer 404. */
	async preview(
		token: string,
		caller: InviteLinkCaller,
	): Promise<InviteLinkPreview> {
		assertVerified(caller);
		const row = await this.links.findByToken(token);
		const link = row ? parseInviteLink(row) : null;
		if (!row || !link || row.revokedAt !== null) {
			throw new InviteLinkInvalidError();
		}

		const inviterName = row.creatorName || row.creatorEmail;
		const expired = row.expiresAt <= new Date();
		if (link.kind === "workspace") {
			return {
				expired,
				inviterName,
				kind: "workspace",
				role: link.role,
				workspaceName: link.workspaceName,
			};
		}
		// A link to a deleted or V1 project is dead, like a revoked one.
		if (!link.projectIsLiveV2) {
			throw new InviteLinkInvalidError();
		}
		return {
			expired,
			inviterName,
			kind: "project",
			projectName: link.projectName,
			role: link.role,
		};
	}

	/**
	 * Joins the workspace or the project of the link. Existing access never
	 * goes down: a member keeps their role, and a grant keeps the higher role.
	 * The project owner gets no grant.
	 */
	async accept(
		token: string,
		caller: InviteLinkCaller,
	): Promise<AcceptInviteLinkResponse> {
		assertVerified(caller);
		const row = await this.links.findByToken(token);
		const link = row ? parseInviteLink(row) : null;
		if (!row || !link) {
			throw new InviteLinkInvalidError();
		}

		const outcome = inviteLinkAcceptOutcome({
			expiresAt: row.expiresAt,
			now: new Date(),
			revokedAt: row.revokedAt,
			target: await this.acceptTarget(link, caller.id),
		});

		switch (outcome.kind) {
			case "invalid":
				throw new InviteLinkInvalidError();
			case "workspace":
				if (outcome.joinRole !== null) {
					await this.members.insertMemberIfAbsent({
						organizationId: outcome.organizationId,
						role: outcome.joinRole,
						userId: caller.id,
					});
				}
				return { kind: "workspace", organizationId: outcome.organizationId };
			case "project":
				if (outcome.grantRole !== null) {
					await this.grants.upsertNoDowngrade({
						invitedByUserId: row.createdByUserId,
						projectId: outcome.projectId,
						role: outcome.grantRole,
						userId: caller.id,
					});
				}
				return { kind: "project", projectId: outcome.projectId };
		}
	}

	/** Reads the caller's current access to the link target. */
	private async acceptTarget(
		link: ParsedInviteLink,
		callerUserId: string,
	): Promise<InviteLinkAcceptTarget> {
		if (link.kind === "workspace") {
			const membership = await this.members.findMembership(
				link.organizationId,
				callerUserId,
			);
			return {
				callerIsMember: membership !== null,
				kind: "workspace",
				organizationId: link.organizationId,
				role: link.role,
			};
		}
		const access = await this.projectAccess.resolve(
			callerUserId,
			link.projectId,
		);
		return {
			callerRole: access?.role ?? null,
			kind: "project",
			projectId: link.projectId,
			projectIsLiveV2: link.projectIsLiveV2,
			role: link.role,
		};
	}
}

// Links and invitations need a verified owner of the email (workspaces-sharing.md 5).
function assertVerified(caller: InviteLinkCaller): void {
	if (!caller.emailVerified) {
		throw new EmailNotVerifiedError();
	}
}

/** Parses the text role and the target of a stored link. Null for a row that breaks the rules. */
function parseInviteLink(row: InviteLinkWithFacts): ParsedInviteLink | null {
	if (row.organizationId !== null && row.organizationName !== null) {
		const role = workspaceInviteLinkRoleSchema.safeParse(row.role);
		return role.success
			? {
					kind: "workspace",
					organizationId: row.organizationId,
					role: role.data,
					workspaceName: row.organizationName,
				}
			: null;
	}
	if (row.projectId !== null && row.projectName !== null) {
		const role = projectInviteLinkRoleSchema.safeParse(row.role);
		return role.success
			? {
					kind: "project",
					projectId: row.projectId,
					projectIsLiveV2:
						row.projectEngine === "v2_app" && row.projectDeletedAt === null,
					projectName: row.projectName,
					role: role.data,
				}
			: null;
	}
	return null;
}

function toWorkspaceInviteLink(row: InviteLinkRow): WorkspaceInviteLink | null {
	const role = workspaceInviteLinkRoleSchema.safeParse(row.role);
	return role.success ? { ...rowDates(row), role: role.data } : null;
}

function rowDates(row: InviteLinkRow): Omit<WorkspaceInviteLink, "role"> {
	return {
		createdAt: row.createdAt.toISOString(),
		expiresAt: row.expiresAt.toISOString(),
		id: row.id,
		token: row.token,
	};
}
