/**
 * Database part of the membership cleanup of workspaces-sharing.md 2.1: grants, team projects,
 * links, and pending project invitations, in one transaction. It also lists the open builder turns.
 * MembershipCleanupService calls it after a removal, a leave, or a change to viewer.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, notInArray, or, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { builderTurns } from "@wandit/db/schema/builder-turns";
import {
	inviteLinks,
	projectInvitations,
	projectMembers,
} from "@wandit/db/schema/project-sharing";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { TERMINAL_TURN_STATUSES } from "../../../app-builder";
import {
	type DatabaseClient,
	type WorkspaceMembership,
	WorkspaceMembersRepository,
	workspaceProjectsPredicate,
} from "./members.repository";

/** One builder turn that has not ended, with the owner columns of its project. */
export type OpenTurnRow = {
	turnId: string;
	projectId: string;
	/** `projects.user_id` after the cleanup transaction. */
	projectUserId: string;
	projectOrganizationId: string | null;
};

/** Private to WorkspacesModule. MembershipCleanupService is its only caller. */
@Injectable()
export class MembershipCleanupRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
	) {}

	/**
	 * Removes the user's grants on the workspace projects. A team gives the user's
	 * projects to the earliest owner. A removal also revokes the links (see `revokeLinks`)
	 * and the pending project invitations that the user could still use.
	 * Returns the new team owner of the projects, or null when no team owner exists.
	 */
	async removeAccess(input: {
		workspace: Pick<
			WorkspaceMembership,
			"organizationId" | "personalOwnerUserId"
		>;
		userId: string;
		/** True for remove-member, false for leave. */
		removedByManager: boolean;
	}): Promise<{ projectsReassignedTo: string | null }> {
		const workspaceProjectIds = this.db
			.select({ id: projects.id })
			.from(projects)
			.where(workspaceProjectsPredicate(input.workspace));

		return this.db.transaction(async (tx) => {
			await tx
				.delete(projectMembers)
				.where(
					and(
						eq(projectMembers.userId, input.userId),
						inArray(projectMembers.projectId, workspaceProjectIds),
					),
				);

			let projectsReassignedTo: string | null = null;
			// A team project needs a creator who is still a member (workspaces-sharing.md 2.1).
			// A personal project always belongs to the personal owner, who never leaves.
			if (input.workspace.personalOwnerUserId === null) {
				projectsReassignedTo = await this.members.findEarliestOwnerUserId(
					input.workspace.organizationId,
					tx,
				);
				if (projectsReassignedTo !== null) {
					await tx
						.update(projects)
						.set({ updatedAt: new Date(), userId: projectsReassignedTo })
						.where(
							and(
								eq(projects.organizationId, input.workspace.organizationId),
								eq(projects.userId, input.userId),
							),
						);
				}
			}

			if (input.removedByManager) {
				await this.revokeLinks(input.workspace, tx);
				// Stored emails are canonical, so the user row email matches the invitation email.
				await tx
					.update(projectInvitations)
					.set({ respondedAt: new Date(), status: "canceled" })
					.where(
						and(
							eq(projectInvitations.status, "pending"),
							inArray(projectInvitations.projectId, workspaceProjectIds),
							eq(
								projectInvitations.email,
								sql`(select ${user.email} from ${user} where ${user.id} = ${input.userId})`,
							),
						),
					);
			}

			return { projectsReassignedTo };
		});
	}

	/**
	 * Revokes the active links of the workspace and of its projects. A removed member or a
	 * member changed to viewer knows the tokens, and a link gives a member row or a grant again.
	 */
	async revokeLinks(
		workspace: Pick<
			WorkspaceMembership,
			"organizationId" | "personalOwnerUserId"
		>,
		/** The pool, or the transaction of `removeAccess`. */
		client: DatabaseClient = this.db,
	): Promise<void> {
		await client
			.update(inviteLinks)
			.set({ revokedAt: new Date() })
			.where(
				and(
					isNull(inviteLinks.revokedAt),
					or(
						eq(inviteLinks.organizationId, workspace.organizationId),
						inArray(
							inviteLinks.projectId,
							client
								.select({ id: projects.id })
								.from(projects)
								.where(workspaceProjectsPredicate(workspace)),
						),
					),
				),
			);
	}

	/**
	 * The user's turns that have not ended, on the live workspace projects or on one project.
	 * A deleted project is left out: the cancel path answers 404 for it, and its delete task stops its run.
	 */
	async listOpenTurns(input: {
		userId: string;
		where:
			| {
					kind: "workspace";
					workspace: Pick<
						WorkspaceMembership,
						"organizationId" | "personalOwnerUserId"
					>;
			  }
			| { kind: "project"; projectId: string };
	}): Promise<OpenTurnRow[]> {
		return this.db
			.select({
				projectId: builderTurns.projectId,
				projectOrganizationId: projects.organizationId,
				projectUserId: projects.userId,
				turnId: builderTurns.id,
			})
			.from(builderTurns)
			.innerJoin(projects, eq(projects.id, builderTurns.projectId))
			.where(
				and(
					eq(builderTurns.userId, input.userId),
					notInArray(builderTurns.status, [...TERMINAL_TURN_STATUSES]),
					isNull(projects.deletedAt),
					input.where.kind === "workspace"
						? workspaceProjectsPredicate(input.where.workspace)
						: eq(builderTurns.projectId, input.where.projectId),
				),
			);
	}
}
