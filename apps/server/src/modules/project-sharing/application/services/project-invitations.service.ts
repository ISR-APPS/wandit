/**
 * Project email invitations (workspaces-sharing.md 5): create and cancel on the project side,
 * and list, read, accept, and decline on the invitee side.
 * ProjectSharingController and ProjectInvitationsController call it. It sends mail through EmailService.
 */
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { canonicalizeEmail } from "@wandit/auth/email-canonical";
import { WORKSPACE_INVITATION_EXPIRES_IN_DAYS } from "@wandit/auth/workspace-membership-rules";
import type {
	AcceptProjectInvitationResponse,
	CreateProjectInvitationsBody,
	CreateProjectInvitationsResponse,
	ListReceivedProjectInvitationsResponse,
	ProjectInvitation,
	ReceivedProjectInvitation,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { EmailService } from "../../../email/application/services/email.service";
import { EmailSendPolicyService } from "../../../email/application/services/email-send-policy.service";
import {
	ProjectAccessService,
	type ResolvedProjectAccess,
} from "../../../projects";
import {
	PROJECT_INVITATION_TTL_MS,
	WorkspacePermissionDeniedError,
} from "../../../workspaces";
import { ProjectInvitationInvalidError } from "../../domain/errors/project-sharing.errors";
import {
	canManageGrant,
	isInvitationRecipient,
} from "../../domain/sharing-rules";
import {
	ProjectInvitationsRepository,
	type ReceivedInvitationRow,
} from "../../infrastructure/persistence/project-invitations.repository";
import { ProjectSharingRepository } from "../../infrastructure/persistence/project-sharing.repository";

/** The session user on an invitee route. Only these fields decide the recipient check. */
export type InvitationCaller = Pick<AuthUser, "id" | "email" | "emailVerified">;

/** Invitee methods answer 404 `PROJECT_INVITATION_INVALID` unless the caller is the verified recipient. */
@Injectable()
export class ProjectInvitationsService {
	private readonly logger = new Logger(ProjectInvitationsService.name);

	constructor(
		@Inject(ProjectInvitationsRepository)
		private readonly invitations: ProjectInvitationsRepository,
		@Inject(ProjectSharingRepository)
		private readonly sharing: ProjectSharingRepository,
		@Inject(ProjectAccessService)
		private readonly projectAccess: ProjectAccessService,
		@Inject(EmailService) private readonly email: EmailService,
		@Inject(EmailSendPolicyService)
		private readonly sendPolicy: EmailSendPolicyService,
	) {}

	/**
	 * Invites 1 to 20 emails, or renews their pending invitations. One email
	 * goes to each address through the invitation send policy; a failed send never fails the invite.
	 */
	async create(input: {
		access: ResolvedProjectAccess;
		inviter: Pick<AuthUser, "id" | "name" | "email">;
		body: CreateProjectInvitationsBody;
	}): Promise<CreateProjectInvitationsResponse> {
		const { access, body, inviter } = input;
		const emails = [...new Set(body.emails.map(canonicalizeEmail))];
		// The recipient could never finish a verified sign-in with a disposable address.
		if (emails.some((email) => this.sendPolicy.isDisposableDomain(email))) {
			throw new BadRequestException({
				code: "EMAIL_DOMAIN_BLOCKED",
				message: "This email domain is not supported.",
			});
		}

		// An invitation replaces the pending one, so an editor may not replace an admin invitation.
		const pending = await this.invitations.findPendingRoles(
			access.project.id,
			emails,
		);
		const allowed = [null, ...pending.map((row) => row.role)].every((from) =>
			canManageGrant({
				actorRole: access.role,
				actorUserId: inviter.id,
				from,
				targetUserId: null,
				to: body.role,
			}),
		);
		if (!allowed) {
			throw new WorkspacePermissionDeniedError();
		}

		const invitations = await this.invitations.upsertPending({
			emails,
			expiresAt: new Date(Date.now() + PROJECT_INVITATION_TTL_MS),
			inviterUserId: inviter.id,
			projectId: access.project.id,
			role: body.role,
		});
		await this.sendInvitationEmails(access, inviter, invitations);
		return { invitations };
	}

	/** Cancels one pending invitation. An admin invitation needs an admin. */
	async cancel(input: {
		access: ResolvedProjectAccess;
		actorUserId: string;
		invitationId: string;
	}): Promise<void> {
		const { access } = input;
		const role = await this.invitations.findPendingRole(
			access.project.id,
			input.invitationId,
		);
		if (role === null) {
			throw new NotFoundException();
		}
		if (
			!canManageGrant({
				actorRole: access.role,
				actorUserId: input.actorUserId,
				from: role,
				targetUserId: null,
				to: null,
			})
		) {
			throw new WorkspacePermissionDeniedError();
		}
		if (
			!(await this.invitations.cancel(access.project.id, input.invitationId))
		) {
			throw new NotFoundException();
		}
	}

	/** The caller's pending invitations. An unverified session sees none. */
	async listReceived(
		caller: InvitationCaller,
	): Promise<ListReceivedProjectInvitationsResponse> {
		if (!caller.emailVerified) {
			return { invitations: [] };
		}
		const now = new Date();
		const rows = await this.invitations.listReceivedPending(
			canonicalizeEmail(caller.email),
			now,
		);
		return { invitations: rows.map((row) => toReceived(row, now)) };
	}

	/** One invitation of the caller. 404 unless the caller is the verified recipient. */
	async getReceived(
		caller: InvitationCaller,
		invitationId: string,
	): Promise<ReceivedProjectInvitation> {
		return toReceived(
			await this.requireReceived(caller, invitationId),
			new Date(),
		);
	}

	/**
	 * Accepts the invitation and writes the grant. The grant upsert never lowers a grant,
	 * and the owner never gets a grant. 404 for an expired or answered invitation.
	 */
	async accept(
		caller: InvitationCaller,
		invitationId: string,
	): Promise<AcceptProjectInvitationResponse> {
		const row = await this.requireReceived(caller, invitationId);
		if (row.status !== "pending" || row.expiresAt <= new Date()) {
			throw new ProjectInvitationInvalidError();
		}
		const current = await this.projectAccess.resolve(caller.id, row.projectId);
		// A role from the workspace alone goes away when the owner sets Restricted, so it still needs the grant.
		const accepted = await this.invitations.accept({
			invitationId,
			userId: caller.id,
			writeGrant: current?.role !== "owner",
		});
		if (!accepted) {
			throw new ProjectInvitationInvalidError();
		}
		return accepted;
	}

	async decline(caller: InvitationCaller, invitationId: string): Promise<void> {
		await this.requireReceived(caller, invitationId);
		if (!(await this.invitations.decline(invitationId))) {
			throw new ProjectInvitationInvalidError();
		}
	}

	/**
	 * The invitation row when the caller is its verified recipient and the project
	 * is a live V2 project. Every other case answers the same 404.
	 */
	private async requireReceived(
		caller: InvitationCaller,
		invitationId: string,
	): Promise<ReceivedInvitationRow> {
		const row = await this.invitations.findReceived(invitationId);
		if (
			!row?.projectIsLiveV2 ||
			!isInvitationRecipient({
				emailVerified: caller.emailVerified,
				invitationEmail: row.email,
				sessionEmail: caller.email,
			})
		) {
			throw new ProjectInvitationInvalidError();
		}
		return row;
	}

	/**
	 * Sends one email per invitation. The invite page and the in-app banner stay the fallback.
	 * The sends run one after another: each policy check must see the sends before it,
	 * or one request goes past the daily inviter cap.
	 */
	private async sendInvitationEmails(
		access: ResolvedProjectAccess,
		inviter: Pick<AuthUser, "id" | "name" | "email">,
		invitations: ProjectInvitation[],
	): Promise<void> {
		const projectName = await this.sharing.findProjectName(access.project.id);
		for (const invitation of invitations) {
			try {
				if (
					!(await this.sendPolicy.allowInvitationSend({
						email: invitation.email,
						inviterUserId: inviter.id,
					}))
				) {
					continue;
				}
				await this.email.sendProjectInvitationEmail({
					expiresInDays: WORKSPACE_INVITATION_EXPIRES_IN_DAYS,
					inviteUrl: `${env.CORS_ORIGIN}/project-invite/${invitation.id}`,
					inviterName: inviter.name || inviter.email,
					projectName: projectName ?? "",
					role: invitation.role,
					to: invitation.email,
					workspaceName: access.workspace?.name ?? "",
				});
			} catch (error) {
				// A failed send never fails the invite. The invite page stays the fallback.
				this.logger.error(
					`Project invitation email failed for invitation ${invitation.id}`,
					error,
				);
			}
		}
	}
}

function toReceived(
	row: ReceivedInvitationRow,
	now: Date,
): ReceivedProjectInvitation {
	return {
		createdAt: row.createdAt.toISOString(),
		expired: row.expiresAt <= now,
		expiresAt: row.expiresAt.toISOString(),
		id: row.id,
		inviterName: row.inviterName || row.inviterEmail,
		projectId: row.projectId,
		projectName: row.projectName,
		role: row.role,
		status: row.status,
		workspaceName: row.workspaceName,
	};
}
