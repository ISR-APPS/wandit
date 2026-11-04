import {
	isPersonalWorkspaceSlug,
	memberRoleUpdateRefusal,
	type WorkspaceInviteFacts,
	workspaceInviteRefusal,
} from "@wandit/auth/workspace-membership-rules";
import { describe, expect, it } from "vitest";

const team = { kind: "team" } as const;
const personal = { kind: "personal", ownerUserId: "owner-1" } as const;

function invite(
	overrides: Partial<WorkspaceInviteFacts>,
): WorkspaceInviteFacts {
	return {
		callerRoles: ["member"],
		callerUserId: "caller-1",
		hasPendingInvitation: false,
		organizationsEnabled: true,
		requestedRoles: ["viewer"],
		resend: false,
		workspace: team,
		...overrides,
	};
}

describe("workspaceInviteRefusal", () => {
	it.each([
		["an editor invites a viewer", invite({}), null],
		[
			"an editor invites an admin",
			invite({ requestedRoles: ["admin"] }),
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"an editor hides an editor role next to viewer",
			invite({ requestedRoles: ["viewer", "member"] }),
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"an editor resends",
			invite({ resend: true }),
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"an editor replaces a pending invitation",
			invite({ hasPendingInvitation: true }),
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"an admin resends an admin invitation",
			invite({
				callerRoles: ["admin"],
				hasPendingInvitation: true,
				requestedRoles: ["admin"],
				resend: true,
			}),
			null,
		],
		[
			"an admin invites an owner",
			invite({ callerRoles: ["admin"], requestedRoles: ["owner"] }),
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a team owner invites an owner",
			invite({ callerRoles: ["owner"], requestedRoles: ["owner"] }),
			null,
		],
		[
			"the personal owner invites an owner",
			invite({
				callerRoles: ["owner"],
				callerUserId: "owner-1",
				requestedRoles: ["owner"],
				workspace: personal,
			}),
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a stray owner row in a personal workspace invites an admin",
			invite({
				callerRoles: ["owner"],
				requestedRoles: ["admin"],
				workspace: personal,
			}),
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"the personal owner invites while the toggle is off",
			invite({
				callerRoles: ["owner"],
				callerUserId: "owner-1",
				organizationsEnabled: false,
				workspace: personal,
			}),
			"ORGANIZATIONS_DISABLED",
		],
		[
			"a team owner invites while the toggle is off",
			invite({ callerRoles: ["owner"], organizationsEnabled: false }),
			null,
		],
	])("%s", (_name, facts, expectedCode) => {
		expect(workspaceInviteRefusal(facts)?.code ?? null).toBe(expectedCode);
	});
});

describe("memberRoleUpdateRefusal", () => {
	it.each([
		["personal: demote the personal owner", "owner-1", ["admin"], true],
		["personal: grant owner to a member", "member-1", ["owner"], true],
		["personal: make a member an admin", "member-1", ["admin"], false],
	])("%s", (_name, memberUserId, newRoles, refused) => {
		expect(
			memberRoleUpdateRefusal({
				memberUserId,
				newRoles,
				workspace: personal,
			}) !== null,
		).toBe(refused);
	});

	it("allows a team owner grant (Better Auth checks the caller)", () => {
		expect(
			memberRoleUpdateRefusal({
				memberUserId: "member-1",
				newRoles: ["owner"],
				workspace: team,
			}),
		).toBeNull();
	});
});

describe("isPersonalWorkspaceSlug", () => {
	it.each([
		["personal-3f2a", true],
		["  Personal-3f2a", true],
		["personalteam", false],
		["my-personal-team", false],
	])("%s gives %s", (slug, reserved) => {
		expect(isPersonalWorkspaceSlug(slug)).toBe(reserved);
	});
});
