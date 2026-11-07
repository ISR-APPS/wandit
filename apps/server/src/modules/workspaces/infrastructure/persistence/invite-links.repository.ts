/**
 * Reads and writes `invite_links` rows: workspace links and project links (workspaces-sharing.md 1).
 * InviteLinksService, ProjectSharingService, and the membership cleanup call it.
 * A new link revokes the active link of the same target in one transaction.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, isNull, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { organization } from "@wandit/db/schema/organizations";
import { inviteLinks } from "@wandit/db/schema/project-sharing";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { DatabaseClient } from "./members.repository";

/** One link as its managers see it. `role` is the raw text column; the service parses it. */
export type InviteLinkRow = {
	id: string;
	token: string;
	role: string;
	expiresAt: Date;
	createdAt: Date;
};

/** The target of a link. The table CHECK allows exactly one. */
export type InviteLinkTarget =
	| { kind: "workspace"; organizationId: string }
	| { kind: "project"; projectId: string };

/** One link by token, with the facts that the preview and accept read. */
export type InviteLinkWithFacts = {
	revokedAt: Date | null;
	expiresAt: Date;
	role: string;
	/** Set for a workspace link. */
	organizationId: string | null;
	organizationName: string | null;
	/** Set for a project link. */
	projectId: string | null;
	projectName: string | null;
	projectEngine: string | null;
	projectDeletedAt: Date | null;
	createdByUserId: string;
	creatorName: string;
	creatorEmail: string;
};

const LINK_COLUMNS = {
	createdAt: inviteLinks.createdAt,
	expiresAt: inviteLinks.expiresAt,
	id: inviteLinks.id,
	role: inviteLinks.role,
	token: inviteLinks.token,
};

/** Every write keeps one active link per target; a revoke sets `revoked_at` and never deletes. */
@Injectable()
export class InviteLinksRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The active, unexpired links of one workspace: at most one per role. */
	async listActiveForOrganization(
		organizationId: string,
		now: Date,
	): Promise<InviteLinkRow[]> {
		return this.db
			.select(LINK_COLUMNS)
			.from(inviteLinks)
			.where(
				and(
					eq(inviteLinks.organizationId, organizationId),
					isNull(inviteLinks.revokedAt),
					gt(inviteLinks.expiresAt, now),
				),
			)
			.orderBy(asc(inviteLinks.role));
	}

	/** The active, unexpired link of one project, or null. */
	async findActiveForProject(
		projectId: string,
		now: Date,
	): Promise<InviteLinkRow | null> {
		const [row] = await this.db
			.select(LINK_COLUMNS)
			.from(inviteLinks)
			.where(
				and(
					eq(inviteLinks.projectId, projectId),
					isNull(inviteLinks.revokedAt),
					gt(inviteLinks.expiresAt, now),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/**
	 * Revokes the active link of the target (and role, for a workspace) and inserts the new one.
	 * One active link per role (workspace) and one per project (workspaces-sharing.md 1).
	 */
	async replace(input: {
		target: InviteLinkTarget;
		role: string;
		token: string;
		createdByUserId: string;
		expiresAt: Date;
	}): Promise<InviteLinkRow> {
		const { target } = input;
		const targetId =
			target.kind === "workspace" ? target.organizationId : target.projectId;

		return this.db.transaction(async (tx) => {
			// Two parallel creates for one target would both pass the revoke and
			// then break the partial unique index. The lock makes the second wait.
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`invite-links:${targetId}`}))`,
			);
			await tx
				.update(inviteLinks)
				.set({ revokedAt: new Date() })
				.where(
					and(
						isNull(inviteLinks.revokedAt),
						target.kind === "workspace"
							? and(
									eq(inviteLinks.organizationId, target.organizationId),
									eq(inviteLinks.role, input.role),
								)
							: eq(inviteLinks.projectId, target.projectId),
					),
				);
			const [row] = await tx
				.insert(inviteLinks)
				.values({
					createdByUserId: input.createdByUserId,
					expiresAt: input.expiresAt,
					organizationId:
						target.kind === "workspace" ? target.organizationId : null,
					projectId: target.kind === "project" ? target.projectId : null,
					role: input.role,
					token: input.token,
				})
				.returning(LINK_COLUMNS);
			if (!row) {
				throw new Error(`invite_links insert returned no row for ${targetId}`);
			}
			return row;
		});
	}

	/** Revokes one workspace link. False when no active link of this workspace has that id. */
	async revokeWorkspaceLink(
		organizationId: string,
		linkId: string,
	): Promise<boolean> {
		const revoked = await this.db
			.update(inviteLinks)
			.set({ revokedAt: new Date() })
			.where(
				and(
					eq(inviteLinks.id, linkId),
					eq(inviteLinks.organizationId, organizationId),
					isNull(inviteLinks.revokedAt),
				),
			)
			.returning({ id: inviteLinks.id });

		return revoked.length > 0;
	}

	/** Revokes the active link of one project. A project without a link is a no-op. */
	async revokeProjectLink(
		projectId: string,
		/** The pool, or the transaction of a move. */
		client: DatabaseClient = this.db,
	): Promise<void> {
		await client
			.update(inviteLinks)
			.set({ revokedAt: new Date() })
			.where(
				and(
					eq(inviteLinks.projectId, projectId),
					isNull(inviteLinks.revokedAt),
				),
			);
	}

	/** One link by token, revoked and expired rows too, so the preview can say "expired". */
	async findByToken(token: string): Promise<InviteLinkWithFacts | null> {
		const [row] = await this.db
			.select({
				createdByUserId: inviteLinks.createdByUserId,
				creatorEmail: user.email,
				creatorName: user.name,
				expiresAt: inviteLinks.expiresAt,
				organizationId: inviteLinks.organizationId,
				organizationName: organization.name,
				projectDeletedAt: projects.deletedAt,
				projectEngine: projects.engine,
				projectId: inviteLinks.projectId,
				projectName: projects.name,
				revokedAt: inviteLinks.revokedAt,
				role: inviteLinks.role,
			})
			.from(inviteLinks)
			.innerJoin(user, eq(user.id, inviteLinks.createdByUserId))
			.leftJoin(organization, eq(organization.id, inviteLinks.organizationId))
			.leftJoin(projects, eq(projects.id, inviteLinks.projectId))
			.where(eq(inviteLinks.token, token))
			.limit(1);

		return row ?? null;
	}
}
