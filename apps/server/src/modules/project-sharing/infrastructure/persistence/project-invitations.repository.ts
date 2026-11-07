/**
 * Reads and writes `project_invitations` rows: create, cancel, and the invitee reads and answers.
 * ProjectInvitationsService and ProjectSharingService call it.
 * Accept writes the status and the grant in one transaction.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
	ProjectInvitation,
	ProjectInvitationStatus,
	ProjectMemberRole,
} from "@wandit/contracts";
import {
	alias,
	and,
	asc,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	type SQL,
	sql,
} from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { organization } from "@wandit/db/schema/organizations";
import { projectInvitations } from "@wandit/db/schema/project-sharing";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { ProjectGrantsRepository } from "../../../workspaces";

/** One invitation with the names that the invitee pages show. */
export type ReceivedInvitationRow = {
	id: string;
	projectId: string;
	/** Canonical invitee email. */
	email: string;
	role: ProjectMemberRole;
	status: ProjectInvitationStatus;
	expiresAt: Date;
	createdAt: Date;
	projectName: string;
	/** The team name, or the personal workspace name of the project owner. */
	workspaceName: string;
	/** False for a deleted project or an engine other than `v2_app`. */
	projectIsLiveV2: boolean;
	inviterName: string;
	inviterEmail: string;
	inviterUserId: string;
};

const INVITATION_COLUMNS = {
	createdAt: projectInvitations.createdAt,
	email: projectInvitations.email,
	expiresAt: projectInvitations.expiresAt,
	id: projectInvitations.id,
	role: projectInvitations.role,
};

const teamOrganization = alias(organization, "team_organization");
const personalOrganization = alias(organization, "personal_organization");
const inviter = alias(user, "inviter");

/** Only a `pending` row changes; every write is a compare-and-set on that status. */
@Injectable()
export class ProjectInvitationsRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(ProjectGrantsRepository)
		private readonly grants: ProjectGrantsRepository,
	) {}

	/** Pending, unexpired invitations of one project, oldest first. */
	async listPending(
		projectId: string,
		now: Date,
	): Promise<ProjectInvitation[]> {
		const rows = await this.db
			.select(INVITATION_COLUMNS)
			.from(projectInvitations)
			.where(
				and(
					eq(projectInvitations.projectId, projectId),
					eq(projectInvitations.status, "pending"),
					gt(projectInvitations.expiresAt, now),
				),
			)
			.orderBy(asc(projectInvitations.createdAt));

		return rows.map(toProjectInvitation);
	}

	/** Roles of the pending invitations of these emails. An editor may not replace an admin one. */
	async findPendingRoles(
		projectId: string,
		emails: string[],
	): Promise<{ email: string; role: ProjectMemberRole }[]> {
		return this.db
			.select({
				email: projectInvitations.email,
				role: projectInvitations.role,
			})
			.from(projectInvitations)
			.where(
				and(
					eq(projectInvitations.projectId, projectId),
					eq(projectInvitations.status, "pending"),
					inArray(projectInvitations.email, emails),
				),
			);
	}

	/**
	 * Creates one pending invitation per email, or renews the pending one: new
	 * role, inviter, and expiry. The pending partial unique index keeps one per email.
	 */
	async upsertPending(input: {
		projectId: string;
		/** Canonical, unique emails. */
		emails: string[];
		role: ProjectMemberRole;
		inviterUserId: string;
		expiresAt: Date;
	}): Promise<ProjectInvitation[]> {
		const rows = await this.db
			.insert(projectInvitations)
			.values(
				input.emails.map((email) => ({
					email,
					expiresAt: input.expiresAt,
					inviterUserId: input.inviterUserId,
					projectId: input.projectId,
					role: input.role,
				})),
			)
			.onConflictDoUpdate({
				set: {
					createdAt: new Date(),
					expiresAt: input.expiresAt,
					inviterUserId: input.inviterUserId,
					role: input.role,
				},
				target: [projectInvitations.projectId, projectInvitations.email],
				targetWhere: sql`${projectInvitations.status} = 'pending'`,
			})
			.returning(INVITATION_COLUMNS);

		return rows.map(toProjectInvitation);
	}

	/** The role of one pending invitation of this project, or null. */
	async findPendingRole(
		projectId: string,
		invitationId: string,
	): Promise<ProjectMemberRole | null> {
		const [row] = await this.db
			.select({ role: projectInvitations.role })
			.from(projectInvitations)
			.where(
				and(
					eq(projectInvitations.id, invitationId),
					eq(projectInvitations.projectId, projectId),
					eq(projectInvitations.status, "pending"),
				),
			)
			.limit(1);

		return row?.role ?? null;
	}

	/** Cancels one pending invitation of this project. False when none was pending. */
	async cancel(projectId: string, invitationId: string): Promise<boolean> {
		const canceled = await this.db
			.update(projectInvitations)
			.set({ respondedAt: new Date(), status: "canceled" })
			.where(
				and(
					eq(projectInvitations.id, invitationId),
					eq(projectInvitations.projectId, projectId),
					eq(projectInvitations.status, "pending"),
				),
			)
			.returning({ id: projectInvitations.id });

		return canceled.length > 0;
	}

	/** One invitation by id, with the names the invitee page shows. */
	async findReceived(
		invitationId: string,
	): Promise<ReceivedInvitationRow | null> {
		const [row] = await this.receivedQuery(
			eq(projectInvitations.id, invitationId),
		).limit(1);

		return row ?? null;
	}

	/** The pending invitations to one canonical email, newest first. Expired rows are left out. */
	async listReceivedPending(
		email: string,
		now: Date,
	): Promise<ReceivedInvitationRow[]> {
		return this.receivedQuery(
			and(
				eq(projectInvitations.email, email),
				eq(projectInvitations.status, "pending"),
				gt(projectInvitations.expiresAt, now),
				isNull(projects.deletedAt),
				eq(projects.engine, "v2_app"),
			),
		).orderBy(desc(projectInvitations.createdAt));
	}

	/**
	 * Marks the invitation accepted and writes the grant in one transaction.
	 * The compare-and-set on `pending` makes a second accept a no-op. Null when it lost.
	 */
	async accept(input: {
		invitationId: string;
		userId: string;
		/** False skips the grant: the user owns the project, and the owner is never a grant. */
		writeGrant: boolean;
	}): Promise<{ projectId: string } | null> {
		return this.db.transaction(async (tx) => {
			const [accepted] = await tx
				.update(projectInvitations)
				.set({ respondedAt: new Date(), status: "accepted" })
				.where(
					and(
						eq(projectInvitations.id, input.invitationId),
						eq(projectInvitations.status, "pending"),
						gt(projectInvitations.expiresAt, new Date()),
					),
				)
				.returning({
					inviterUserId: projectInvitations.inviterUserId,
					projectId: projectInvitations.projectId,
					role: projectInvitations.role,
				});
			if (!accepted) {
				return null;
			}
			if (input.writeGrant) {
				await this.grants.upsertNoDowngrade(
					{
						invitedByUserId: accepted.inviterUserId,
						projectId: accepted.projectId,
						role: accepted.role,
						userId: input.userId,
					},
					tx,
				);
			}
			return { projectId: accepted.projectId };
		});
	}

	/** Declines one pending invitation. False when it was not pending. */
	async decline(invitationId: string): Promise<boolean> {
		const declined = await this.db
			.update(projectInvitations)
			.set({ respondedAt: new Date(), status: "declined" })
			.where(
				and(
					eq(projectInvitations.id, invitationId),
					eq(projectInvitations.status, "pending"),
				),
			)
			.returning({ id: projectInvitations.id });

		return declined.length > 0;
	}

	private receivedQuery(where: SQL | undefined) {
		return (
			this.db
				.select({
					createdAt: projectInvitations.createdAt,
					email: projectInvitations.email,
					expiresAt: projectInvitations.expiresAt,
					id: projectInvitations.id,
					inviterEmail: inviter.email,
					inviterName: inviter.name,
					inviterUserId: projectInvitations.inviterUserId,
					projectId: projectInvitations.projectId,
					projectIsLiveV2: sql<boolean>`(${projects.deletedAt} is null and ${projects.engine} = 'v2_app')`,
					projectName: projects.name,
					role: projectInvitations.role,
					status: projectInvitations.status,
					workspaceName: sql<string>`coalesce(${teamOrganization.name}, ${personalOrganization.name}, '')`,
				})
				.from(projectInvitations)
				.innerJoin(projects, eq(projects.id, projectInvitations.projectId))
				.innerJoin(inviter, eq(inviter.id, projectInvitations.inviterUserId))
				.leftJoin(
					teamOrganization,
					eq(teamOrganization.id, projects.organizationId),
				)
				// A personal project keeps organization_id NULL; its workspace is the owner's personal org.
				.leftJoin(
					personalOrganization,
					and(
						isNull(projects.organizationId),
						eq(personalOrganization.personalOwnerUserId, projects.userId),
					),
				)
				.where(where)
		);
	}
}

function toProjectInvitation(row: {
	createdAt: Date;
	email: string;
	expiresAt: Date;
	id: string;
	role: ProjectMemberRole;
}): ProjectInvitation {
	return {
		...row,
		createdAt: row.createdAt.toISOString(),
		expiresAt: row.expiresAt.toISOString(),
	};
}
