import { PgDialect } from "@wandit/db";
import { describe, expect, it } from "vitest";

import type { WorkspaceContext } from "../../workspaces/domain/workspace-context";
import type { ResolvedProjectAccess } from "./project-access";
import {
	meteringSubjectFrom,
	projectOwnerColumns,
	projectScopeFrom,
	projectScopeFromAccess,
	projectScopePredicate,
} from "./project-scope";

describe("projectScopeFrom", () => {
	it.each<{
		name: string;
		workspace: WorkspaceContext;
		scope: ReturnType<typeof projectScopeFrom>;
		subject: ReturnType<typeof meteringSubjectFrom>;
		ownerColumns: ReturnType<typeof projectOwnerColumns>;
	}>([
		{
			name: "own personal workspace: the caller owns, pays, and skips the default limit",
			ownerColumns: { organizationId: null, userId: "user_1" },
			scope: {
				actorIsLimitExempt: true,
				actorRoles: ["owner"],
				actorUserId: "user_1",
				kind: "personal",
				ownerUserId: "user_1",
			},
			subject: { actorIsLimitExempt: true, actorUserId: "user_1" },
			workspace: { kind: "personal" },
		},
		{
			name: "another user's personal workspace: that owner owns the projects and pays",
			ownerColumns: { organizationId: null, userId: "user_2" },
			scope: {
				actorIsLimitExempt: false,
				actorRoles: ["admin"],
				actorUserId: "user_1",
				kind: "personal",
				ownerUserId: "user_2",
			},
			subject: {
				actorIsLimitExempt: false,
				actorUserId: "user_1",
				payerUserId: "user_2",
			},
			workspace: {
				kind: "shared-personal",
				organizationId: "personal_org_2",
				ownerUserId: "user_2",
				role: "admin",
				roles: ["admin"],
			},
		},
		{
			name: "team admin: the org pays and the admin skips the default limit",
			ownerColumns: { organizationId: "org_1", userId: "user_1" },
			scope: {
				actorIsLimitExempt: true,
				actorRoles: ["admin"],
				actorUserId: "user_1",
				kind: "org",
				organizationId: "org_1",
			},
			subject: {
				actorIsLimitExempt: true,
				actorUserId: "user_1",
				organizationId: "org_1",
			},
			workspace: {
				kind: "org",
				organizationId: "org_1",
				role: "admin",
				roles: ["admin"],
			},
		},
		{
			name: "team member: the org pays and the default limit applies",
			ownerColumns: { organizationId: "org_1", userId: "user_1" },
			scope: {
				actorIsLimitExempt: false,
				actorRoles: ["member"],
				actorUserId: "user_1",
				kind: "org",
				organizationId: "org_1",
			},
			subject: {
				actorIsLimitExempt: false,
				actorUserId: "user_1",
				organizationId: "org_1",
			},
			workspace: {
				kind: "org",
				organizationId: "org_1",
				role: "member",
				roles: ["member"],
			},
		},
	])("$name", ({ workspace, scope, subject, ownerColumns }) => {
		const actual = projectScopeFrom(workspace, "user_1");

		expect(actual).toEqual(scope);
		expect(meteringSubjectFrom(actual)).toEqual(subject);
		expect(projectOwnerColumns(actual)).toEqual(ownerColumns);
	});
});

describe("projectScopePredicate", () => {
	it.each<{
		name: string;
		workspace: WorkspaceContext | undefined;
		sql: string;
		params: string[];
	}>([
		{
			name: "personal owner: no Restricted filter",
			params: ["user_1"],
			sql: '("projects"."user_id" = $1 and "projects"."organization_id" is null)',
			workspace: undefined,
		},
		{
			name: "shared-personal admin: the owner's projects, Restricted ones only as creator or by grant",
			params: ["user_2", "restricted", "user_1", "user_1"],
			sql: '(("projects"."user_id" = $1 and "projects"."organization_id" is null) and ("projects"."workspace_access" <> $2 or "projects"."user_id" = $3 or exists (select 1 from "project_members" where "project_members"."project_id" = "projects"."id" and "project_members"."user_id" = $4)))',
			workspace: {
				kind: "shared-personal",
				organizationId: "personal_org_2",
				ownerUserId: "user_2",
				role: "admin",
				roles: ["admin"],
			},
		},
		{
			name: "team viewer: no creator term, Restricted ones only by grant",
			params: ["org_1", "restricted", "user_1"],
			sql: '("projects"."organization_id" = $1 and ("projects"."workspace_access" <> $2 or exists (select 1 from "project_members" where "project_members"."project_id" = "projects"."id" and "project_members"."user_id" = $3)))',
			workspace: {
				kind: "org",
				organizationId: "org_1",
				role: "viewer",
				roles: ["viewer"],
			},
		},
		{
			name: "team member: Restricted ones as creator or by grant",
			params: ["org_1", "restricted", "user_1", "user_1"],
			sql: '("projects"."organization_id" = $1 and ("projects"."workspace_access" <> $2 or "projects"."user_id" = $3 or exists (select 1 from "project_members" where "project_members"."project_id" = "projects"."id" and "project_members"."user_id" = $4)))',
			workspace: {
				kind: "org",
				organizationId: "org_1",
				role: "member",
				roles: ["member"],
			},
		},
	])("$name", ({ workspace, sql, params }) => {
		const compiled = new PgDialect().sqlToQuery(
			projectScopePredicate(projectScopeFrom(workspace, "user_1")),
		);

		expect(compiled.sql).toBe(sql);
		expect(compiled.params).toEqual(params);
	});
});

describe("projectScopeFromAccess", () => {
	// The project row decides the payer, never the workspace header.
	it.each<{
		name: string;
		project: Pick<
			ResolvedProjectAccess["project"],
			"organizationId" | "userId"
		>;
		workspaceRoles: ResolvedProjectAccess["workspaceRoles"];
		scope: ReturnType<typeof projectScopeFromAccess>;
		subject: ReturnType<typeof meteringSubjectFrom>;
	}>([
		{
			name: "personal owner: the owner pays and skips the default limit",
			project: { organizationId: null, userId: "user_1" },
			scope: {
				actorIsLimitExempt: true,
				actorRoles: ["owner"],
				actorUserId: "user_1",
				kind: "personal",
				ownerUserId: "user_1",
			},
			subject: { actorIsLimitExempt: true, actorUserId: "user_1" },
			workspaceRoles: [],
		},
		{
			name: "personal workspace admin: the owner pays and the default limit applies",
			project: { organizationId: null, userId: "user_2" },
			scope: {
				actorIsLimitExempt: false,
				actorRoles: ["admin"],
				actorUserId: "user_1",
				kind: "personal",
				ownerUserId: "user_2",
			},
			subject: {
				actorIsLimitExempt: false,
				actorUserId: "user_1",
				payerUserId: "user_2",
			},
			workspaceRoles: ["admin"],
		},
		{
			name: "direct grant on a personal project: the owner pays",
			project: { organizationId: null, userId: "user_2" },
			scope: {
				actorIsLimitExempt: false,
				actorRoles: [],
				actorUserId: "user_1",
				kind: "personal",
				ownerUserId: "user_2",
			},
			subject: {
				actorIsLimitExempt: false,
				actorUserId: "user_1",
				payerUserId: "user_2",
			},
			workspaceRoles: [],
		},
		{
			name: "team admin: the project's org pays and the admin skips the default limit",
			project: { organizationId: "org_1", userId: "user_2" },
			scope: {
				actorIsLimitExempt: true,
				actorRoles: ["admin"],
				actorUserId: "user_1",
				kind: "org",
				organizationId: "org_1",
			},
			subject: {
				actorIsLimitExempt: true,
				actorUserId: "user_1",
				organizationId: "org_1",
			},
			workspaceRoles: ["admin"],
		},
		{
			name: "direct grant on a team project: the org pays and the default limit applies",
			project: { organizationId: "org_1", userId: "user_2" },
			scope: {
				actorIsLimitExempt: false,
				actorRoles: [],
				actorUserId: "user_1",
				kind: "org",
				organizationId: "org_1",
			},
			subject: {
				actorIsLimitExempt: false,
				actorUserId: "user_1",
				organizationId: "org_1",
			},
			workspaceRoles: [],
		},
	])("$name", ({ project, workspaceRoles, scope, subject }) => {
		const actual = projectScopeFromAccess(
			{
				directRole: null,
				project: {
					engine: "v2_app",
					id: "project_1",
					workspaceAccess: "can_edit",
					...project,
				},
				role: "editor",
				workspace: null,
				workspaceRoles,
			},
			"user_1",
		);

		expect(actual).toEqual(scope);
		expect(meteringSubjectFrom(actual)).toEqual(subject);
	});
});
