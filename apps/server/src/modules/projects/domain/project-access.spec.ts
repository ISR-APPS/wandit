import type { ProjectRole } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	canDeleteProject,
	type ProjectAccessFacts,
	type ProjectRoleFacts,
	projectRoleOf,
	type ResolvedProjectAccess,
	resolveProjectAccess,
} from "./project-access";

// A team project of `creator` that `actor` opens, before the overrides.
const TEAM_PROJECT: ProjectRoleFacts = {
	actorUserId: "actor",
	directRole: null,
	projectOrganizationId: "org_1",
	projectUserId: "creator",
	workspaceAccess: "can_edit",
	workspaceRoles: [],
};

// A personal project of `owner` that `actor` opens, before the overrides.
const PERSONAL_PROJECT: ProjectRoleFacts = {
	...TEAM_PROJECT,
	projectOrganizationId: null,
	projectUserId: "owner",
};

describe("projectRoleOf", () => {
	it.each<[string, ProjectRoleFacts, ProjectRole | null]>([
		[
			"team owner on a Restricted project",
			{
				...TEAM_PROJECT,
				workspaceAccess: "restricted",
				workspaceRoles: ["owner"],
			},
			"owner",
		],
		[
			"creator with role member on a Restricted project",
			{
				...TEAM_PROJECT,
				actorUserId: "creator",
				workspaceAccess: "restricted",
				workspaceRoles: ["member"],
			},
			"owner",
		],
		[
			"creator downgraded to viewer",
			{ ...TEAM_PROJECT, actorUserId: "creator", workspaceRoles: ["viewer"] },
			"viewer",
		],
		[
			"creator downgraded to viewer on a Restricted project",
			{
				...TEAM_PROJECT,
				actorUserId: "creator",
				workspaceAccess: "restricted",
				workspaceRoles: ["viewer"],
			},
			null,
		],
		["team admin", { ...TEAM_PROJECT, workspaceRoles: ["admin"] }, "admin"],
		[
			"team admin on a Restricted project",
			{
				...TEAM_PROJECT,
				workspaceAccess: "restricted",
				workspaceRoles: ["admin"],
			},
			null,
		],
		[
			"member with Can edit",
			{ ...TEAM_PROJECT, workspaceRoles: ["member"] },
			"editor",
		],
		[
			"member with Can view",
			{
				...TEAM_PROJECT,
				workspaceAccess: "can_view",
				workspaceRoles: ["member"],
			},
			"viewer",
		],
		[
			"member on a Restricted project",
			{
				...TEAM_PROJECT,
				workspaceAccess: "restricted",
				workspaceRoles: ["member"],
			},
			null,
		],
		[
			"workspace viewer with Can edit",
			{ ...TEAM_PROJECT, workspaceRoles: ["viewer"] },
			"viewer",
		],
		["non-member without a grant", TEAM_PROJECT, null],
		[
			"direct grant on a Restricted project",
			{ ...TEAM_PROJECT, directRole: "editor", workspaceAccess: "restricted" },
			"editor",
		],
		[
			"direct admin above member with Can view",
			{
				...TEAM_PROJECT,
				directRole: "admin",
				workspaceAccess: "can_view",
				workspaceRoles: ["member"],
			},
			"admin",
		],
		[
			"workspace admin above a direct viewer grant",
			{ ...TEAM_PROJECT, directRole: "viewer", workspaceRoles: ["admin"] },
			"admin",
		],
		[
			"multi-role member and admin",
			{
				...TEAM_PROJECT,
				workspaceAccess: "can_view",
				workspaceRoles: ["member", "admin"],
			},
			"admin",
		],
		[
			"personal owner on a Restricted project",
			{
				...PERSONAL_PROJECT,
				actorUserId: "owner",
				workspaceAccess: "restricted",
			},
			"owner",
		],
		[
			"member.role owner in a personal workspace",
			{ ...PERSONAL_PROJECT, workspaceRoles: ["owner"] },
			null,
		],
		[
			"personal workspace member with Can edit",
			{ ...PERSONAL_PROJECT, workspaceRoles: ["member"] },
			"editor",
		],
	])("%s", (_name, facts, expected) => {
		expect(projectRoleOf(facts)).toBe(expected);
	});
});

describe("resolveProjectAccess", () => {
	// Security: a stray `owner` in a personal workspace must not reach later role checks.
	it("drops a member.role owner of a personal workspace that the actor does not own", () => {
		const facts: ProjectAccessFacts = {
			directRole: null,
			engine: "v2_app",
			id: "project_1",
			memberRole: "owner,member",
			organizationId: null,
			userId: "owner",
			workspaceAccess: "can_edit",
			workspaceId: "personal_org",
			workspaceName: "Owner's workspace",
			workspacePersonalOwnerUserId: "owner",
		};

		const access = resolveProjectAccess(facts, "actor");

		expect(access?.role).toBe("editor");
		expect(access?.workspaceRoles).toEqual(["member"]);
	});
});

describe("canDeleteProject", () => {
	it.each<
		[
			string,
			Pick<ResolvedProjectAccess["project"], "engine" | "organizationId">,
			ProjectRole,
			ResolvedProjectAccess["workspaceRoles"],
			boolean,
		]
	>([
		[
			"V2 owner",
			{ engine: "v2_app", organizationId: "org_1" },
			"owner",
			["member"],
			true,
		],
		[
			"V2 team admin",
			{ engine: "v2_app", organizationId: "org_1" },
			"admin",
			["admin"],
			false,
		],
		[
			"V1 personal owner",
			{ engine: "v1_page", organizationId: null },
			"owner",
			[],
			true,
		],
		[
			"V1 team admin",
			{ engine: "v1_page", organizationId: "org_1" },
			"admin",
			["admin"],
			true,
		],
		[
			"V1 team member",
			{ engine: "v1_page", organizationId: "org_1" },
			"editor",
			["member"],
			false,
		],
		[
			"V1 direct grant only",
			{ engine: "v1_page", organizationId: "org_1" },
			"admin",
			[],
			false,
		],
	])("%s", (_name, project, role, workspaceRoles, expected) => {
		const access: ResolvedProjectAccess = {
			directRole: null,
			project: {
				id: "project_1",
				userId: "creator",
				workspaceAccess: "can_edit",
				...project,
			},
			role,
			workspace: null,
			workspaceRoles,
		};

		expect(canDeleteProject(access)).toBe(expected);
	});
});
