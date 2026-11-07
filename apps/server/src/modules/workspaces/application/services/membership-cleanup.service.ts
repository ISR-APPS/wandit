/**
 * Cleanup after a member loses access (workspaces-sharing.md 2.1 and 2.2).
 * The Better Auth hooks (via AuthModule), the staff set-role, and ProjectSharingService call it.
 * It writes through MembershipCleanupRepository and cancels turns through the V2 TurnsService.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { MembershipReduction } from "@wandit/auth";
import { env } from "@wandit/env/server";

// TurnsService resolves lazily through ModuleRef: the app-builder module only loads
// under `V2_BUILDER_ENABLED`, so a static provider edge would be wrong.
import { TurnsService } from "../../../app-builder";
import {
	ProjectAccessService,
	projectRoleAtLeast,
	systemProjectScope,
} from "../../../projects";
import { WorkspaceMembersRepository } from "../../infrastructure/persistence/members.repository";
import {
	MembershipCleanupRepository,
	type OpenTurnRow,
} from "../../infrastructure/persistence/membership-cleanup.repository";

/**
 * `TurnsService.cancel` writes the IP in its audit row. A Better Auth plugin
 * hook has no request, so the row names the system as the source.
 */
const SYSTEM_AUDIT_IP = "system";

/** Exported by WorkspacesModule for AuthModule, AdminModule, and ProjectSharingModule. */
@Injectable()
export class MembershipCleanupService {
	private readonly logger = new Logger(MembershipCleanupService.name);

	constructor(
		@Inject(MembershipCleanupRepository)
		private readonly cleanup: MembershipCleanupRepository,
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
		@Inject(ProjectAccessService)
		private readonly projectAccess: ProjectAccessService,
		@Inject(ModuleRef)
		private readonly moduleRef: ModuleRef,
	) {}

	/**
	 * Runs the cleanup of one removal, leave, or change to viewer. Every failure propagates.
	 * The caller then undoes the member change, so a retry runs the cleanup again.
	 */
	async handleMembershipReduced(reduction: MembershipReduction): Promise<void> {
		const organization = await this.members.findOrganization(
			reduction.organizationId,
		);
		if (!organization) {
			this.logger.warn(
				`Membership cleanup skipped: organization ${reduction.organizationId} is missing`,
			);
			return;
		}
		const workspace = {
			organizationId: reduction.organizationId,
			personalOwnerUserId: organization.personalOwnerUserId,
		};

		try {
			if (reduction.change === "viewer") {
				// A change to viewer keeps grants and projects. An old link must not give edit access back
				// (workspaces-sharing.md 5), so the links of the workspace die.
				await this.cleanup.revokeLinks(workspace);
			} else {
				const { projectsReassignedTo } = await this.cleanup.removeAccess({
					removedByManager: reduction.change === "removed",
					userId: reduction.userId,
					workspace,
				});
				if (
					workspace.personalOwnerUserId === null &&
					projectsReassignedTo === null
				) {
					this.logger.warn(
						`Team ${reduction.organizationId} has no owner, so the projects of user ${reduction.userId} keep their creator`,
					);
				}
			}
		} catch (error) {
			this.logger.error(
				`Membership cleanup failed for user ${reduction.userId} in ${reduction.organizationId} (${reduction.change})`,
				error,
			);
			throw error;
		}

		await this.cancelTurnsWithoutEditAccess({
			// The plugin hooks get no session, so the member whose access changed is the audit actor.
			actorUserId: reduction.userId,
			ipAddress: reduction.ipAddress,
			turns: await this.cleanup.listOpenTurns({
				userId: reduction.userId,
				where: { kind: "workspace", workspace },
			}),
			userId: reduction.userId,
		});
	}

	/**
	 * Cancels the user's open turns on one project when the user can no longer edit it.
	 * ProjectSharingService calls it after it removes a grant or lowers it to viewer.
	 */
	async cancelProjectTurnsWithoutEditAccess(input: {
		/** The user who lost the grant. Only the turns of this user stop. */
		userId: string;
		projectId: string;
		/** The user who removed or lowered the grant. The audit rows of a team project name this user. */
		actorUserId: string;
		/** Client IP of the request that removed or lowered the grant. */
		ipAddress: string;
	}): Promise<void> {
		await this.cancelTurnsWithoutEditAccess({
			actorUserId: input.actorUserId,
			ipAddress: input.ipAddress,
			turns: await this.cleanup.listOpenTurns({
				userId: input.userId,
				where: { kind: "project", projectId: input.projectId },
			}),
			userId: input.userId,
		});
	}

	/**
	 * Cancels each turn whose project the user can no longer edit. The cancel path
	 * refunds the hold. It throws after all cancels ran when one failed:
	 * a `waiting` turn never ends by itself, and a later promotion would start it.
	 */
	private async cancelTurnsWithoutEditAccess(input: {
		/** The user who started the turns and lost access. */
		userId: string;
		turns: OpenTurnRow[];
		/** The user that the `turn.cancel` audit rows name on a team project. */
		actorUserId: string;
		/** Client IP for the audit rows. Null when the Better Auth hook has no request. */
		ipAddress: string | null;
	}): Promise<void> {
		// No V2 module means no builder turns can exist.
		if (input.turns.length === 0 || !env.V2_BUILDER_ENABLED) {
			return;
		}
		const turnsService = this.moduleRef.get(TurnsService, { strict: false });

		const results = await Promise.allSettled(
			input.turns.map(async (turn) => {
				const access = await this.projectAccess.resolve(
					input.userId,
					turn.projectId,
				);
				// The user can still edit this project through another grant.
				if (access && projectRoleAtLeast(access.role, "editor")) {
					return;
				}
				// A team system scope shows every project to any actor. A personal scope
				// shows a Restricted project only to its owner, so the owner acts there.
				// The payer is the project payer either way, so the hold refund finds the event.
				// LIMIT: the cancel audit row of a personal project names its owner. Upgrade: an audit actor parameter on TurnsService.cancel.
				const scope = systemProjectScope(
					{
						organizationId: turn.projectOrganizationId,
						userId: turn.projectUserId,
					},
					turn.projectOrganizationId === null
						? turn.projectUserId
						: input.actorUserId,
					false,
				);
				await turnsService.cancel(
					scope,
					turn.projectId,
					turn.turnId,
					input.ipAddress ?? SYSTEM_AUDIT_IP,
				);
			}),
		);

		let failedCount = 0;
		results.forEach((result, index) => {
			if (result.status === "rejected") {
				failedCount += 1;
				this.logger.error(
					`Turn cancel failed for turn ${input.turns[index]?.turnId} of user ${input.userId}`,
					result.reason,
				);
			}
		});
		if (failedCount > 0) {
			throw new Error(
				`${failedCount} turn cancels failed for user ${input.userId}`,
			);
		}
	}
}
