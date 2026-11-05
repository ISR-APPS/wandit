import { describe, expect, it } from "vitest";

import {
	canManageGrant,
	canSetWorkspaceAccess,
	type GrantChange,
	isInvitationRecipient,
	type MoveFacts,
	moveBlockedReason,
	narrowsWorkspaceAccess,
	sharingStateFor,
} from "./sharing-rules";

const change = (overrides: Partial<GrantChange>): GrantChange => ({
	actorRole: "editor",
	actorUserId: "actor-1",
	from: "viewer",
	targetUserId: "target-1",
	to: "editor",
	...overrides,
});

describe("canManageGrant", () => {
	it.each<[string, GrantChange, boolean]>([
		["an editor raises a viewer to editor", change({}), true],
		["an editor invites an admin", change({ from: null, to: "admin" }), false],
		["an editor removes an admin", change({ from: "admin", to: null }), false],
		[
			"an editor replaces a pending admin invitation",
			change({ from: "admin", targetUserId: null, to: "viewer" }),
			false,
		],
		["a viewer changes a grant", change({ actorRole: "viewer" }), false],
		[
			"a viewer removes their own grant",
			change({
				actorRole: "viewer",
				targetUserId: "actor-1",
				to: null,
			}),
			true,
		],
		[
			"a viewer raises their own grant",
			change({ actorRole: "viewer", targetUserId: "actor-1" }),
			false,
		],
		[
			"an admin grants admin",
			change({ actorRole: "admin", to: "admin" }),
			true,
		],
	])("%s", (_name, input, allowed) => {
		expect(canManageGrant(input)).toBe(allowed);
	});
});

describe("canSetWorkspaceAccess", () => {
	it.each([
		["editor", "can_edit", "can_view", true],
		["viewer", "can_edit", "can_view", false],
		["admin", "can_edit", "restricted", false],
		["admin", "restricted", "can_edit", false],
		["owner", "restricted", "can_view", true],
	] as const)("%s: %s to %s gives %s", (actorRole, from, to, allowed) => {
		expect(canSetWorkspaceAccess({ actorRole, from, to })).toBe(allowed);
	});
});

describe("narrowsWorkspaceAccess", () => {
	it.each([
		["can_edit", "can_view", true],
		["can_edit", "restricted", true],
		["can_view", "restricted", true],
		["can_view", "can_edit", false],
		["restricted", "can_view", false],
		["can_edit", "can_edit", false],
	] as const)("%s to %s narrows: %s", (from, to, narrows) => {
		expect(narrowsWorkspaceAccess(from, to)).toBe(narrows);
	});
});

describe("isInvitationRecipient", () => {
	it.each([
		[
			"the same email, verified",
			"dev@wandit.test",
			true,
			"dev@wandit.test",
			true,
		],
		[
			"a legacy dotted gmail session",
			"D.e.v@gmail.com",
			true,
			"dev@gmail.com",
			true,
		],
		[
			"an unverified session",
			"dev@wandit.test",
			false,
			"dev@wandit.test",
			false,
		],
		["another email", "other@wandit.test", true, "dev@wandit.test", false],
	])("%s", (_name, sessionEmail, emailVerified, invitationEmail, recipient) => {
		expect(
			isInvitationRecipient({ emailVerified, invitationEmail, sessionEmail }),
		).toBe(recipient);
	});
});

describe("moveBlockedReason", () => {
	const free: MoveFacts = {
		customDomainAttached: false,
		desktopBuildInFlight: false,
		destinationHasBackendSlot: false,
		deviceSessionActive: false,
		mobileBuildInFlight: false,
		projectHasBackend: false,
		publishInFlight: false,
		turnActive: false,
		usageReserved: false,
	};

	it.each<[Partial<MoveFacts>, ReturnType<typeof moveBlockedReason>]>([
		[{}, null],
		[{ turnActive: true }, "turn_active"],
		[{ usageReserved: true }, "usage_reserved"],
		[{ publishInFlight: true }, "publish_in_flight"],
		[{ mobileBuildInFlight: true }, "mobile_build_in_flight"],
		[{ desktopBuildInFlight: true }, "desktop_build_in_flight"],
		[{ deviceSessionActive: true }, "device_session_active"],
		[{ customDomainAttached: true }, "custom_domain_attached"],
		[{ projectHasBackend: true }, "backend_slot_unavailable"],
		[{ destinationHasBackendSlot: true, projectHasBackend: true }, null],
	])("%o gives %s", (facts, reason) => {
		expect(moveBlockedReason({ ...free, ...facts })).toBe(reason);
	});
});

describe("sharingStateFor", () => {
	const state = {
		invitations: [
			{
				createdAt: "2026-11-04T00:00:00.000Z",
				email: "invitee@wandit.test",
				expiresAt: "2026-12-04T00:00:00.000Z",
				id: "6f0c5a52-4a3f-4c3c-9d1e-2b8f6d6d4a10",
				role: "editor" as const,
			},
		],
		inviteLink: {
			expiresAt: "2026-11-11T00:00:00.000Z",
			role: "editor" as const,
			token: "a".repeat(43),
		},
		members: [],
		owner: { email: "o@wandit.test", image: null, name: "O", userId: "o" },
		workspace: { id: "org-1", kind: "team" as const, name: "Acme" },
		workspaceAccess: "can_edit" as const,
	};

	it("hides the invitations and the link token from a viewer", () => {
		const visible = sharingStateFor("viewer", state);
		expect(visible.invitations).toBeUndefined();
		expect(visible.inviteLink).toEqual({
			expiresAt: "2026-11-11T00:00:00.000Z",
			role: "editor",
		});
	});

	it("shows them to an editor", () => {
		const visible = sharingStateFor("editor", state);
		expect(visible.invitations).toHaveLength(1);
		expect(visible.inviteLink?.token).toBe("a".repeat(43));
	});
});
