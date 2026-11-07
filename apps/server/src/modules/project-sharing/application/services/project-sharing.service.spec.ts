import type { ProjectMember, ProjectMemberRole } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { ResolvedProjectAccess } from "../../../projects";
import {
	type InviteLinksRepository,
	type MembershipCleanupService,
	type WorkspaceMembersRepository,
	WorkspacePermissionDeniedError,
	type WorkspacesService,
} from "../../../workspaces";
import type { ProjectInvitationsRepository } from "../../infrastructure/persistence/project-invitations.repository";
import type { ProjectSharingRepository } from "../../infrastructure/persistence/project-sharing.repository";
import { ProjectSharingService } from "./project-sharing.service";

/** The seventh constructor parameter. The billing module has no barrel for its repository type. */
type SubscriptionsRepository = ConstructorParameters<
	typeof ProjectSharingService
>[6];

const ACTOR = { id: "user_actor", ipAddress: "203.0.113.9" };
const TARGET_USER_ID = "user_target";

/** The actor created the team project, so rule 1 makes the actor its owner. */
function teamProjectAccess(
	workspaceRoles: ResolvedProjectAccess["workspaceRoles"],
): ResolvedProjectAccess {
	return {
		directRole: null,
		project: {
			engine: "v2_app",
			id: "project_1",
			organizationId: "org_source",
			userId: ACTOR.id,
			workspaceAccess: "can_edit",
		},
		role: "owner",
		workspace: {
			id: "org_source",
			kind: "team",
			name: "Source team",
			personalOwnerUserId: null,
		},
		workspaceRoles,
	};
}

function memberWithRole(role: ProjectMemberRole): ProjectMember {
	return {
		createdAt: "2026-11-01T00:00:00.000Z",
		email: "target@example.com",
		image: null,
		name: "Target",
		role,
		userId: TARGET_USER_ID,
	};
}

function setup(input: {
	/** Raw `member.role` of the actor in the destination team workspace. */
	destinationRole?: string;
	/** True when the turn cancel after a downgrade throws. */
	cancelFails?: boolean;
}) {
	/** Roles that `updateMemberRole` wrote, in call order. */
	const roleWrites: ProjectMemberRole[] = [];
	const movedProjectIds: string[] = [];

	const sharing: Pick<
		ProjectSharingRepository,
		"findMemberRole" | "moveProject" | "updateMemberRole"
	> = {
		findMemberRole: async () => "editor",
		moveProject: async ({ projectId }) => {
			movedProjectIds.push(projectId);
			return { kind: "moved" };
		},
		updateMemberRole: async (_projectId, _userId, role) => {
			roleWrites.push(role);
			return memberWithRole(role);
		},
	};
	const inviteLinks: Pick<InviteLinksRepository, "revokeProjectLink"> = {
		revokeProjectLink: async () => undefined,
	};
	const cleanup: Pick<
		MembershipCleanupService,
		"cancelProjectTurnsWithoutEditAccess"
	> = {
		cancelProjectTurnsWithoutEditAccess: async () => {
			if (input.cancelFails) {
				throw new Error("turn cancel failed");
			}
		},
	};
	const members: Pick<WorkspaceMembersRepository, "findMembership"> = {
		findMembership: async (organizationId) => ({
			organizationId,
			personalOwnerUserId: null,
			role: input.destinationRole ?? "owner",
		}),
	};
	const subscriptions: Pick<SubscriptionsRepository, "findActiveByOwner"> = {
		findActiveByOwner: async () => null,
	};

	const service = new ProjectSharingService(
		// SAFETY: move and updateMember call only the three methods above.
		sharing as ProjectSharingRepository,
		// SAFETY: move and updateMember never read invitations.
		{} as ProjectInvitationsRepository,
		// SAFETY: updateMember calls only revokeProjectLink.
		inviteLinks as InviteLinksRepository,
		// SAFETY: updateMember calls only cancelProjectTurnsWithoutEditAccess.
		cleanup as MembershipCleanupService,
		// SAFETY: move calls only findMembership for a team destination.
		members as WorkspaceMembersRepository,
		// SAFETY: these cases never move into the personal workspace.
		{} as WorkspacesService,
		// SAFETY: resolveBillingPlan calls only findActiveByOwner.
		subscriptions as SubscriptionsRepository,
	);

	return { movedProjectIds, roleWrites, service };
}

describe("ProjectSharingService.move", () => {
	// Security: only the workspace owner of the source moves, into a workspace where the caller can create projects.
	it.each([
		{
			caller: "the team creator whose workspace role is member",
			sourceWorkspaceRoles: ["member"],
			destinationRole: "owner",
		},
		{
			caller: "a source owner who is only a viewer in the destination",
			sourceWorkspaceRoles: ["owner"],
			destinationRole: "viewer",
		},
	] as const)("refuses $caller with 403", async ({
		sourceWorkspaceRoles,
		destinationRole,
	}) => {
		const { movedProjectIds, service } = setup({ destinationRole });

		await expect(
			service.move({
				access: teamProjectAccess([...sourceWorkspaceRoles]),
				actor: ACTOR,
				body: {
					destinationWorkspaceId: "org_destination",
					keepCollaborators: false,
				},
			}),
		).rejects.toBeInstanceOf(WorkspacePermissionDeniedError);
		expect(movedProjectIds).toEqual([]);
	});
});

describe("ProjectSharingService.updateMember", () => {
	// Without the undo, a retry sees no downgrade and skips the cancel, so a `waiting` turn starts later.
	it("writes the old role back and rethrows when the turn cancel of a downgrade fails", async () => {
		const { roleWrites, service } = setup({ cancelFails: true });

		await expect(
			service.updateMember({
				access: teamProjectAccess(["owner"]),
				actor: ACTOR,
				role: "viewer",
				targetUserId: TARGET_USER_ID,
			}),
		).rejects.toThrow("turn cancel failed");
		expect(roleWrites).toEqual(["viewer", "editor"]);
	});
});
