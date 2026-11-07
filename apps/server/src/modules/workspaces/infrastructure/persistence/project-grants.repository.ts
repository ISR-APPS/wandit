/**
 * Writes a direct project grant (`project_members`) when a link or an email invitation is accepted.
 * InviteLinksService and ProjectInvitationsService call it, the second inside its accept transaction.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { ProjectMemberRole } from "@wandit/contracts";
import { sql } from "@wandit/db";
import { projectMembers } from "@wandit/db/schema/project-sharing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { DatabaseClient } from "./members.repository";

/** Exported by WorkspacesModule, so the V2 ProjectSharingModule writes grants with the same rule. */
@Injectable()
export class ProjectGrantsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Inserts the grant, or keeps the higher of the old and the new role.
	 * An accept never lowers a grant (workspaces-sharing.md 5).
	 */
	async upsertNoDowngrade(
		grant: {
			projectId: string;
			userId: string;
			role: ProjectMemberRole;
			/** The link creator or the inviter. */
			invitedByUserId: string;
		},
		/** The pool, or the transaction of an invitation accept. */
		client: DatabaseClient = this.db,
	): Promise<void> {
		await client
			.insert(projectMembers)
			.values(grant)
			.onConflictDoUpdate({
				set: {
					// The enum order is admin, editor, viewer, so LEAST keeps the higher role.
					role: sql`least(${projectMembers.role}, excluded.role)`,
					updatedAt: new Date(),
				},
				target: [projectMembers.projectId, projectMembers.userId],
			});
	}
}
