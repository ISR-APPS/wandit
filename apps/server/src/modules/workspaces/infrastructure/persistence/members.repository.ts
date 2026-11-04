/**
 * Reads workspace (organization) rows and member rows, and creates personal workspaces.
 * WorkspaceContextGuard, WorkspacesService, member limits, credits, billing, and invite links call it.
 * It writes `organization` and `member` through Drizzle: personal workspaces and invite link joins.
 */
import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { ProjectMemberRole } from "@wandit/contracts";
import { and, asc, eq, isNull, type SQL } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { member, organization } from "@wandit/db/schema/organizations";
import { projectMembers } from "@wandit/db/schema/project-sharing";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";

/** A database handle or an open transaction, for writes that join a caller's transaction. */
export type DatabaseClient =
	| Database
	| Parameters<Parameters<Database["transaction"]>[0]>[0];

export type MemberRow = typeof member.$inferSelect;

/** One result row of listUserMemberships. The rows come in order of org creation date. */
export type MembershipWithOrganization = {
	member: MemberRow;
	organization: {
		id: string;
		name: string;
		slug: string;
		logo: string | null;
		createdAt: Date;
		/** Set: the personal workspace of this user. NULL: a team workspace. */
		personalOwnerUserId: string | null;
	};
};

/** The caller's member row in one org, with the personal owner of that org. */
export type WorkspaceMembership = {
	organizationId: string;
	/** Raw member.role value — may be a comma-separated multi-role string. */
	role: string;
	/** Set: a personal workspace and its owner. NULL: a team workspace. */
	personalOwnerUserId: string | null;
};

/** One direct grant of an external collaborator, with the user and the project. */
export type CollaboratorGrantRow = {
	userId: string;
	name: string;
	email: string;
	image: string | null;
	projectId: string;
	projectName: string;
	role: ProjectMemberRole;
};

/**
 * Selects every project of one workspace, live or deleted.
 * The projects of a personal workspace keep organization_id NULL.
 */
export function workspaceProjectsPredicate(
	workspace: Pick<
		WorkspaceMembership,
		"organizationId" | "personalOwnerUserId"
	>,
): SQL {
	const predicate =
		workspace.personalOwnerUserId === null
			? eq(projects.organizationId, workspace.organizationId)
			: and(
					eq(projects.userId, workspace.personalOwnerUserId),
					isNull(projects.organizationId),
				);
	if (!predicate) {
		throw new Error("Workspace project predicate could not be constructed");
	}
	return predicate;
}

@Injectable()
export class WorkspaceMembersRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** Null when the user is not a member of the org, or the org does not exist. */
	async findMembership(
		organizationId: string,
		userId: string,
	): Promise<WorkspaceMembership | null> {
		const [row] = await this.db
			.select({
				organizationId: member.organizationId,
				personalOwnerUserId: organization.personalOwnerUserId,
				role: member.role,
			})
			.from(member)
			.innerJoin(organization, eq(organization.id, member.organizationId))
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, userId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/**
	 * The user's personal workspace, or null when it does not exist yet.
	 * `hasOwnerMember` is false when the user's own member row in it is missing.
	 */
	async findPersonalWorkspace(
		userId: string,
	): Promise<{ id: string; hasOwnerMember: boolean } | null> {
		const [row] = await this.db
			.select({ id: organization.id, memberId: member.id })
			.from(organization)
			.leftJoin(
				member,
				and(
					eq(member.organizationId, organization.id),
					eq(member.userId, userId),
				),
			)
			.where(eq(organization.personalOwnerUserId, userId))
			.limit(1);

		return row ? { hasOwnerMember: row.memberId !== null, id: row.id } : null;
	}

	/**
	 * Adds the `owner` member row of a personal workspace that has lost it.
	 * The unique (organization_id, user_id) index makes a parallel second insert a no-op.
	 */
	async insertPersonalOwnerMember(
		organizationId: string,
		userId: string,
	): Promise<void> {
		await this.db
			.insert(member)
			.values({ id: randomUUID(), organizationId, role: "owner", userId })
			.onConflictDoNothing({ target: [member.organizationId, member.userId] });
	}

	/** Name and email of a user: the input of the personal workspace name. */
	async findUserNameAndEmail(
		userId: string,
	): Promise<{ name: string; email: string } | null> {
		const [row] = await this.db
			.select({ email: user.email, name: user.name })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Inserts a personal workspace and its one `owner` member row in one transaction.
	 * Returns the new org id, or null when a unique constraint refuses the org:
	 * the user already has a personal workspace, or the slug is taken.
	 */
	async insertPersonalWorkspace(input: {
		userId: string;
		/** Display name, at most 50 characters. */
		name: string;
		/** `personal-` plus random hex; unique across all orgs. */
		slug: string;
	}): Promise<string | null> {
		return this.db.transaction(async (tx) => {
			// No conflict target: a taken slug and an existing personal workspace
			// both give no row. The service tells the two apart.
			const [created] = await tx
				.insert(organization)
				.values({
					id: randomUUID(),
					name: input.name,
					personalOwnerUserId: input.userId,
					slug: input.slug,
				})
				.onConflictDoNothing()
				.returning({ id: organization.id });

			if (!created) {
				return null;
			}

			await tx.insert(member).values({
				id: randomUUID(),
				organizationId: created.id,
				role: "owner",
				userId: input.userId,
			});

			return created.id;
		});
	}

	/** One organization row, or null. Billing reads the name; the cleanup reads the kind. */
	async findOrganization(organizationId: string): Promise<{
		id: string;
		name: string;
		slug: string;
		/** Set: a personal workspace and its owner. NULL: a team workspace. */
		personalOwnerUserId: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				id: organization.id,
				name: organization.name,
				personalOwnerUserId: organization.personalOwnerUserId,
				slug: organization.slug,
			})
			.from(organization)
			.where(eq(organization.id, organizationId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Adds a member row unless the user is already a member. True when it added one.
	 * The unique (organization_id, user_id) index keeps a parallel join a no-op.
	 */
	async insertMemberIfAbsent(input: {
		organizationId: string;
		userId: string;
		role: string;
	}): Promise<boolean> {
		const inserted = await this.db
			.insert(member)
			.values({ id: randomUUID(), ...input })
			.onConflictDoNothing({ target: [member.organizationId, member.userId] })
			.returning({ id: member.id });

		return inserted.length > 0;
	}

	/**
	 * The org's earliest owner-role member: the affiliate-attribution human of
	 * the Stripe customer, and the heir of a removed creator's team projects.
	 * Roles are comma-separated multi-values, so filtering happens after the ordered fetch.
	 */
	async findEarliestOwnerUserId(
		organizationId: string,
		/** The pool, or the transaction of the membership cleanup. */
		client: DatabaseClient = this.db,
	): Promise<string | null> {
		const rows = await client
			.select({
				createdAt: member.createdAt,
				role: member.role,
				userId: member.userId,
			})
			.from(member)
			.where(eq(member.organizationId, organizationId))
			.orderBy(asc(member.createdAt), asc(member.id));

		for (const row of rows) {
			const roles = row.role.split(",").map((value) => value.trim());

			if (roles.includes("owner")) {
				return row.userId;
			}
		}

		return null;
	}

	async listMembersWithUsers(organizationId: string): Promise<
		{
			userId: string;
			name: string;
			email: string;
			role: string;
			joinedAt: Date;
		}[]
	> {
		return this.db
			.select({
				email: user.email,
				joinedAt: member.createdAt,
				name: user.name,
				role: member.role,
				userId: member.userId,
			})
			.from(member)
			.innerJoin(user, eq(user.id, member.userId))
			.where(eq(member.organizationId, organizationId))
			.orderBy(asc(member.createdAt));
	}

	/**
	 * Users with a direct grant on a live project of this workspace who are not
	 * members of it. They spend the workspace pool, so member limits list them.
	 */
	async listExternalCollaborators(
		workspace: Pick<
			WorkspaceMembership,
			"organizationId" | "personalOwnerUserId"
		>,
	): Promise<{ userId: string; name: string; email: string }[]> {
		return this.db
			.selectDistinct({ email: user.email, name: user.name, userId: user.id })
			.from(projectMembers)
			.innerJoin(projects, eq(projects.id, projectMembers.projectId))
			.innerJoin(user, eq(user.id, projectMembers.userId))
			.leftJoin(
				member,
				and(
					eq(member.organizationId, workspace.organizationId),
					eq(member.userId, projectMembers.userId),
				),
			)
			.where(
				and(
					workspaceProjectsPredicate(workspace),
					isNull(projects.deletedAt),
					isNull(member.id),
				),
			)
			.orderBy(asc(user.name), asc(user.id));
	}

	/**
	 * Direct grants of non-members on the live projects that `scope` can open.
	 * The scope applies the Restricted rule, so an admin never sees a project they cannot open.
	 */
	async listCollaboratorGrants(input: {
		/** The caller's scope in this workspace. */
		scope: ProjectScope;
		/** The workspace organization id: its members are not collaborators. */
		organizationId: string;
	}): Promise<CollaboratorGrantRow[]> {
		return this.db
			.select({
				email: user.email,
				image: user.image,
				name: user.name,
				projectId: projects.id,
				projectName: projects.name,
				role: projectMembers.role,
				userId: user.id,
			})
			.from(projectMembers)
			.innerJoin(projects, eq(projects.id, projectMembers.projectId))
			.innerJoin(user, eq(user.id, projectMembers.userId))
			.leftJoin(
				member,
				and(
					eq(member.organizationId, input.organizationId),
					eq(member.userId, projectMembers.userId),
				),
			)
			.where(
				and(
					projectScopePredicate(input.scope),
					isNull(projects.deletedAt),
					isNull(member.id),
				),
			)
			.orderBy(asc(user.name), asc(user.id), asc(projects.name));
	}

	async listUserMemberships(
		userId: string,
	): Promise<MembershipWithOrganization[]> {
		const rows = await this.db
			.select({
				member,
				organization: {
					createdAt: organization.createdAt,
					id: organization.id,
					logo: organization.logo,
					name: organization.name,
					personalOwnerUserId: organization.personalOwnerUserId,
					slug: organization.slug,
				},
			})
			.from(member)
			.innerJoin(organization, eq(organization.id, member.organizationId))
			.where(eq(member.userId, userId))
			.orderBy(asc(organization.createdAt));

		return rows;
	}
}
