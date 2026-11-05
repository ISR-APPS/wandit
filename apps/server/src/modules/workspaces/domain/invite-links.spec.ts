import { describe, expect, it } from "vitest";

import {
	type InviteLinkAcceptOutcome,
	type InviteLinkAcceptTarget,
	inviteLinkAcceptOutcome,
} from "./invite-links";

const now = new Date("2026-11-04T12:00:00.000Z");
const later = new Date("2026-11-05T12:00:00.000Z");

const workspaceLink = (callerIsMember: boolean): InviteLinkAcceptTarget => ({
	callerIsMember,
	kind: "workspace",
	organizationId: "org-1",
	role: "member",
});

const projectLink = (
	overrides: Partial<Extract<InviteLinkAcceptTarget, { kind: "project" }>>,
): InviteLinkAcceptTarget => ({
	callerRole: null,
	kind: "project",
	projectId: "project-1",
	projectIsLiveV2: true,
	role: "editor",
	...overrides,
});

describe("inviteLinkAcceptOutcome", () => {
	it.each<
		[string, Date | null, Date, InviteLinkAcceptTarget, InviteLinkAcceptOutcome]
	>([
		["a revoked link", now, later, workspaceLink(false), { kind: "invalid" }],
		["an expired link", null, now, workspaceLink(false), { kind: "invalid" }],
		[
			"a link to a deleted or V1 project",
			null,
			later,
			projectLink({ projectIsLiveV2: false }),
			{ kind: "invalid" },
		],
		[
			"a new workspace member",
			null,
			later,
			workspaceLink(false),
			{ joinRole: "member", kind: "workspace", organizationId: "org-1" },
		],
		[
			"a downgraded member keeps the lower role",
			null,
			later,
			workspaceLink(true),
			{ joinRole: null, kind: "workspace", organizationId: "org-1" },
		],
		[
			"an admin from the workspace gets the editor grant",
			null,
			later,
			projectLink({ callerRole: "admin" }),
			{ grantRole: "editor", kind: "project", projectId: "project-1" },
		],
		[
			"the owner gets no grant",
			null,
			later,
			projectLink({ callerRole: "owner" }),
			{ grantRole: null, kind: "project", projectId: "project-1" },
		],
	])("%s", (_name, revokedAt, expiresAt, target, expected) => {
		expect(
			inviteLinkAcceptOutcome({ expiresAt, now, revokedAt, target }),
		).toEqual(expected);
	});
});
