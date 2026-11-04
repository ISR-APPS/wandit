/**
 * Reads and writes the sharing state of one V2 project: direct grants, Workspace access,
 * the owner (transfer), and the workspace (move). ProjectSharingService calls it.
 * The move runs in one transaction under the destination payer's `app-backends` lock.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	type BillingPlanId,
	liveAppBuildStatuses,
	liveMobileBuildStatuses,
	type ProjectMember,
	type ProjectMemberRole,
	type ProjectMoveBlockedReason,
	type ProjectWorkspaceAccess,
	type SharingPerson,
} from "@wandit/contracts";
import { and, asc, eq, inArray, isNull, notInArray, sql } from "@wandit/db";
import { appBackends } from "@wandit/db/schema/app-backends";
import { appBuilds } from "@wandit/db/schema/app-builds";
import { user } from "@wandit/db/schema/auth";
import { builderTurns } from "@wandit/db/schema/builder-turns";
import { aiUsageEvents } from "@wandit/db/schema/credits";
import { deviceSessions } from "@wandit/db/schema/device-sessions";
import { domains } from "@wandit/db/schema/domains";
import { mobileBuilds } from "@wandit/db/schema/mobile-builds";
import { projectSecrets } from "@wandit/db/schema/project-secrets";
import {
	projectInvitations,
	projectMembers,
} from "@wandit/db/schema/project-sharing";
import { projects } from "@wandit/db/schema/projects";
import { sandboxSessions } from "@wandit/db/schema/sandbox-sessions";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { assertBackendEntitlement } from "../../../app-builder/domain/backend-lifecycle";
import { TERMINAL_TURN_STATUSES } from "../../../app-builder/domain/turn-queue";
import { AppBackendsRepository } from "../../../app-builder/infrastructure/persistence/app-backends.repository";
import {
	creditOwnerLockValue,
	ownerFromIds,
} from "../../../credits/domain/credit-owner";
import { InviteLinksRepository } from "../../../workspaces";
import { moveBlockedReason } from "../../domain/sharing-rules";

/** The owner columns of a project and of its child rows. Null org: a personal project. */
export type ProjectOwnerColumns = {
	userId: string;
	organizationId: string | null;
};

/** One `project_members` row as stored. Remove returns it, so a failed cleanup can put it back. */
export type ProjectMemberRow = typeof projectMembers.$inferSelect;

/** What a move did. `changed`: another request changed the owner first. */
export type MoveResult =
	| { kind: "moved" }
	| { kind: "blocked"; reason: ProjectMoveBlockedReason }
	| { kind: "changed" };

const MEMBER_COLUMNS = {
	createdAt: projectMembers.createdAt,
	email: user.email,
	image: user.image,
	name: user.name,
	role: projectMembers.role,
	userId: projectMembers.userId,
};

/** Backend statuses that serve no app and hold no plan slot (schema comment of `app_backend_status`). */
const RELEASED_BACKEND_STATUSES = ["deleting", "error"] as const;

/** Reads and writes through Drizzle only. The move also writes the owner columns of three child tables. */
@Injectable()
export class ProjectSharingRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AppBackendsRepository)
		private readonly backends: AppBackendsRepository,
		@Inject(InviteLinksRepository)
		private readonly inviteLinks: InviteLinksRepository,
	) {}

	/** The user that owns the project (`projects.user_id`), as the Share dialog shows it. */
	async findPerson(userId: string): Promise<SharingPerson | null> {
		const [row] = await this.db
			.select({
				email: user.email,
				image: user.image,
				name: user.name,
				userId: user.id,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return row ?? null;
	}

	/** The name of one project, or null when the row is gone. */
	async findProjectName(projectId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ name: projects.name })
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);

		return row?.name ?? null;
	}

	/** The direct grants of one project, sorted by name. */
	async listMembers(projectId: string): Promise<ProjectMember[]> {
		const rows = await this.db
			.select(MEMBER_COLUMNS)
			.from(projectMembers)
			.innerJoin(user, eq(user.id, projectMembers.userId))
			.where(eq(projectMembers.projectId, projectId))
			.orderBy(asc(user.name), asc(user.id));

		return rows.map(toProjectMember);
	}

	/** The role of one direct grant, or null when the user has none. */
	async findMemberRole(
		projectId: string,
		userId: string,
	): Promise<ProjectMemberRole | null> {
		const [row] = await this.db
			.select({ role: projectMembers.role })
			.from(projectMembers)
			.where(
				and(
					eq(projectMembers.projectId, projectId),
					eq(projectMembers.userId, userId),
				),
			)
			.limit(1);

		return row?.role ?? null;
	}

	/** Sets the role of one direct grant. Null when the grant is gone. */
	async updateMemberRole(
		projectId: string,
		userId: string,
		role: ProjectMemberRole,
	): Promise<ProjectMember | null> {
		const updated = await this.db
			.update(projectMembers)
			.set({ role, updatedAt: new Date() })
			.where(
				and(
					eq(projectMembers.projectId, projectId),
					eq(projectMembers.userId, userId),
				),
			)
			.returning({ id: projectMembers.id });
		if (updated.length === 0) {
			return null;
		}

		const [row] = await this.db
			.select(MEMBER_COLUMNS)
			.from(projectMembers)
			.innerJoin(user, eq(user.id, projectMembers.userId))
			.where(
				and(
					eq(projectMembers.projectId, projectId),
					eq(projectMembers.userId, userId),
				),
			)
			.limit(1);

		return row ? toProjectMember(row) : null;
	}

	/** Removes one direct grant. Returns the deleted row, or null when the user had none. */
	async deleteMember(
		projectId: string,
		userId: string,
	): Promise<ProjectMemberRow | null> {
		const [deleted] = await this.db
			.delete(projectMembers)
			.where(
				and(
					eq(projectMembers.projectId, projectId),
					eq(projectMembers.userId, userId),
				),
			)
			.returning();

		return deleted ?? null;
	}

	/** Inserts a deleted grant again. A grant written in the meantime wins. */
	async restoreMember(row: ProjectMemberRow): Promise<void> {
		await this.db.insert(projectMembers).values(row).onConflictDoNothing();
	}

	/** Sets the Workspace access row of one project. The service checks the role first. */
	async updateWorkspaceAccess(
		projectId: string,
		workspaceAccess: ProjectWorkspaceAccess,
	): Promise<void> {
		await this.db
			.update(projects)
			.set({ updatedAt: new Date(), workspaceAccess })
			.where(eq(projects.id, projectId));
	}

	/**
	 * Gives a team project to another workspace member. The new owner's direct
	 * grant goes away: the owner is never a grant. False when the owner changed first.
	 */
	async transferOwner(input: {
		projectId: string;
		organizationId: string;
		fromUserId: string;
		toUserId: string;
	}): Promise<boolean> {
		return this.db.transaction(async (tx) => {
			// Compare-and-set on the old owner: a parallel transfer wins once.
			const moved = await tx
				.update(projects)
				.set({ updatedAt: new Date(), userId: input.toUserId })
				.where(
					and(
						eq(projects.id, input.projectId),
						eq(projects.organizationId, input.organizationId),
						eq(projects.userId, input.fromUserId),
						isNull(projects.deletedAt),
					),
				)
				.returning({ id: projects.id });
			if (moved.length === 0) {
				return false;
			}
			await tx
				.delete(projectMembers)
				.where(
					and(
						eq(projectMembers.projectId, input.projectId),
						eq(projectMembers.userId, input.toUserId),
					),
				);
			return true;
		});
	}

	/**
	 * Moves a project to another workspace (workspaces-sharing.md 5). The slot
	 * count and the owner-column writes run under the destination payer's lock,
	 * so two moves cannot both take the last backend slot.
	 */
	async moveProject(input: {
		projectId: string;
		/** The owner columns the caller saw. The move answers `changed` when they differ. */
		source: ProjectOwnerColumns;
		destination: ProjectOwnerColumns;
		/** The destination payer's plan: it decides the backend slots. */
		destinationPlan: BillingPlanId;
		/** True keeps direct grants and pending invitations. The new owner's grant goes away either way. */
		keepCollaborators: boolean;
	}): Promise<MoveResult> {
		const { projectId } = input;
		const destinationPayer = ownerFromIds(
			input.destination.userId,
			input.destination.organizationId,
		);

		return this.db.transaction(async (tx) => {
			// The same lock as the backend insert: it guards the plan slot count.
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`app-backends:${creditOwnerLockValue(destinationPayer)}`}))`,
			);
			const [project] = await tx
				.select({
					organizationId: projects.organizationId,
					userId: projects.userId,
				})
				.from(projects)
				.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
				.for("update");
			if (
				!project ||
				project.userId !== input.source.userId ||
				project.organizationId !== input.source.organizationId
			) {
				return { kind: "changed" };
			}

			const has = async (rows: Promise<{ id: string }[]>) =>
				(await rows).length > 0;
			const reason = moveBlockedReason({
				customDomainAttached: await has(
					tx
						.select({ id: domains.id })
						.from(domains)
						.where(eq(domains.projectId, projectId))
						.limit(1),
				),
				destinationHasBackendSlot: assertBackendEntitlement(
					input.destinationPlan,
					await this.backends.countActiveForOwner(destinationPayer, tx),
				).allowed,
				deviceSessionActive: await has(
					tx
						.select({ id: deviceSessions.id })
						.from(deviceSessions)
						.where(
							and(
								eq(deviceSessions.projectId, projectId),
								isNull(deviceSessions.endedAt),
							),
						)
						.limit(1),
				),
				mobileBuildInFlight: await has(
					tx
						.select({ id: mobileBuilds.id })
						.from(mobileBuilds)
						.where(
							and(
								eq(mobileBuilds.projectId, projectId),
								inArray(mobileBuilds.status, [...liveMobileBuildStatuses]),
							),
						)
						.limit(1),
				),
				projectHasBackend: await has(
					tx
						.select({ id: appBackends.id })
						.from(appBackends)
						.where(
							and(
								eq(appBackends.projectId, projectId),
								notInArray(appBackends.status, [...RELEASED_BACKEND_STATUSES]),
							),
						)
						.limit(1),
				),
				publishInFlight: await has(
					tx
						.select({ id: appBuilds.id })
						.from(appBuilds)
						.where(
							and(
								eq(appBuilds.projectId, projectId),
								inArray(appBuilds.status, [...liveAppBuildStatuses]),
							),
						)
						.limit(1),
				),
				turnActive: await has(
					tx
						.select({ id: builderTurns.id })
						.from(builderTurns)
						.where(
							and(
								eq(builderTurns.projectId, projectId),
								notInArray(builderTurns.status, [...TERMINAL_TURN_STATUSES]),
							),
						)
						.limit(1),
				),
				usageReserved: await has(
					tx
						.select({ id: aiUsageEvents.id })
						.from(aiUsageEvents)
						.where(
							and(
								eq(aiUsageEvents.projectId, projectId),
								eq(aiUsageEvents.status, "reserved"),
							),
						)
						.limit(1),
				),
			});
			if (reason !== null) {
				return { kind: "blocked", reason };
			}

			const owner = {
				organizationId: input.destination.organizationId,
				userId: input.destination.userId,
			};
			// Workspace access of the old workspace means nothing in the new one.
			await tx
				.update(projects)
				.set({ ...owner, updatedAt: new Date(), workspaceAccess: "can_edit" })
				.where(eq(projects.id, projectId));
			// These rows hold the project owner and payer (workspaces-sharing.md 4).
			await tx
				.update(appBackends)
				.set(owner)
				.where(eq(appBackends.projectId, projectId));
			await tx
				.update(projectSecrets)
				.set(owner)
				.where(eq(projectSecrets.projectId, projectId));
			await tx
				.update(sandboxSessions)
				.set(owner)
				.where(eq(sandboxSessions.projectId, projectId));
			await this.inviteLinks.revokeProjectLink(projectId, tx);
			if (input.keepCollaborators) {
				// The owner is never a grant, like after a transfer. Else the Share dialog shows the owner twice.
				await tx
					.delete(projectMembers)
					.where(
						and(
							eq(projectMembers.projectId, projectId),
							eq(projectMembers.userId, input.destination.userId),
						),
					);
			} else {
				await tx
					.delete(projectMembers)
					.where(eq(projectMembers.projectId, projectId));
				await tx
					.update(projectInvitations)
					.set({ respondedAt: new Date(), status: "canceled" })
					.where(
						and(
							eq(projectInvitations.projectId, projectId),
							eq(projectInvitations.status, "pending"),
						),
					);
			}
			return { kind: "moved" };
		});
	}
}

function toProjectMember(row: {
	createdAt: Date;
	email: string;
	image: string | null;
	name: string;
	role: ProjectMemberRole;
	userId: string;
}): ProjectMember {
	return { ...row, createdAt: row.createdAt.toISOString() };
}
