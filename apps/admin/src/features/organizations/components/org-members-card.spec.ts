import { describe, expect, it } from "vitest";

import { primaryRole } from "./org-members-card";

describe("primaryRole", () => {
	// Viewer and unknown roles must not read as member. Otherwise staff can overwrite them by mistake.
	it.each([
		["viewer", "viewer"],
		["member, viewer", "member"],
		["admin,owner", "owner"],
		["billing", null],
	] as const)("reads %j as %j", (role, expected) => {
		expect(primaryRole(role)).toBe(expected);
	});
});
