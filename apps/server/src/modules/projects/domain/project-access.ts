/**
 * The project role rules of workspaces-sharing.md 2.2: who opens a project, and with which role.
 * ProjectAccessService and ProjectsRepository call resolveProjectAccess on the rows they read.
 * ProjectAccessGuard, the V1 delete route, and the publish override read the results.
 */
import { workspaceRoleHasPermission } from "@wandit/auth/permissions";
import {
	type ProjectAccess,
	type ProjectEngine,
	type ProjectMemberRole,
	type ProjectRole,
	type ProjectWorkspaceAccess,
	projectRoles,
	type WorkspaceKind,
	type WorkspaceRoleName,
} from "@wandit/contracts";

import { parseWorkspaceRoles } from "../../workspaces/domain/workspace-context";

/** The inputs of `projectRoleOf`. Each field is one fact about the project or the actor. */
export type ProjectRoleFacts = {
	/** The signed-in user who asks for access. */
	actorUserId: string;
	/** `projects.user_id`: the creator of a team project, the owner of a personal project. */
	projectUserId: string;
	/** `projects.organization_id`; null for a personal project. */
	projectOrganizationId: string | null;
	workspaceAccess: ProjectWorkspaceAccess;
	/**
	 * The actor's `member.role` names in the project's workspace: the team org,
	 * or the personal org of `projects.user_id`. Empty when the actor is not a member.
	 */
	workspaceRoles: readonly WorkspaceRoleName[];
	/** The actor's `project_members.role`; null without a direct grant. */
	directRole: ProjectMemberRole | null;
};

/**
 * One project row, its workspace, and the actor's two grants, as
 * `ProjectsRepository` reads them in one query.
 */
export type ProjectAccessFacts = {
	/** `projects.id`. */
	id: string;
	/** `projects.user_id`: the creator of a team project, the owner of a personal project. */
	userId: string;
	/** `projects.organization_id`; null for a personal project. */
	organizationId: string | null;
	engine: ProjectEngine;
	workspaceAccess: ProjectWorkspaceAccess;
	/** The team org, or the personal org of `userId`. Null when that org row is missing. */
	workspaceId: string | null;
	workspaceName: string | null;
	/** `organization.personal_owner_user_id`; null for a team workspace. */
	workspacePersonalOwnerUserId: string | null;
	/** The actor's raw `member.role` in that workspace (comma-separated); null when not a member. */
	memberRole: string | null;
	/** The actor's `project_members.role`; null without a direct grant. */
	directRole: ProjectMemberRole | null;
};

/**
 * The actor's access to one live project. ProjectAccessGuard attaches it to the
 * request, and `@CurrentProjectAccess()` reads it. `role` is never "none":
 * a project without a role is a 404.
 */
export type ResolvedProjectAccess = {
	project: Pick<
		ProjectAccessFacts,
		"engine" | "id" | "organizationId" | "userId" | "workspaceAccess"
	>;
	/** Null when the organization row of the workspace is missing. */
	workspace: {
		id: string;
		name: string;
		kind: WorkspaceKind;
		/** Set for a personal workspace: its only owner and payer. */
		personalOwnerUserId: string | null;
	} | null;
	/** Parsed `member.role` of the actor. A personal workspace never gives `owner` here, except to its owner. */
	workspaceRoles: WorkspaceRoleName[];
	directRole: ProjectMemberRole | null;
	role: ProjectRole;
};

/**
 * Effective role of the actor on one project (design 2.2, rules 1 to 4), or
 * null for no access. The caller also checks `deleted_at` and the engine.
 */
export function projectRoleOf(facts: ProjectRoleFacts): ProjectRole | null {
	if (isProjectOwner(facts)) {
		return "owner";
	}

	// Rule 4: the highest of the workspace role and the direct grant.
	return (
		projectRoles.find(
			(role) => role === workspaceRoleOf(facts) || role === facts.directRole,
		) ?? null
	);
}

/**
 * Rule 1: true when the actor holds the role `owner`. A direct grant never
 * gives `owner`, and Workspace access never takes it away.
 */
export function isProjectOwner(
	facts: Pick<
		ProjectRoleFacts,
		"actorUserId" | "projectOrganizationId" | "projectUserId" | "workspaceRoles"
	>,
): boolean {
	// A personal workspace has one owner: `projects.user_id`, never a member with role `owner`.
	if (facts.projectOrganizationId === null) {
		return facts.actorUserId === facts.projectUserId;
	}

	// A team owner owns every project. A creator stays the owner while a member with more than viewer.
	return (
		facts.workspaceRoles.includes("owner") ||
		(facts.actorUserId === facts.projectUserId &&
			facts.workspaceRoles.some((role) => role !== "viewer"))
	);
}

/** True when `role` is `needed` or higher (owner > admin > editor > viewer). */
export function projectRoleAtLeast(
	role: ProjectRole,
	needed: ProjectRole,
): boolean {
	return projectRoles.indexOf(role) <= projectRoles.indexOf(needed);
}

/**
 * Turns one row of facts into the actor's access. Null when the actor has no
 * role on the project.
 */
export function resolveProjectAccess(
	facts: ProjectAccessFacts,
	actorUserId: string,
): ResolvedProjectAccess | null {
	const parsedRoles =
		facts.memberRole === null ? [] : parseWorkspaceRoles(facts.memberRole);
	// Security: only `personal_owner_user_id` holds owner power in a personal
	// workspace (design 2.1), so later role checks never see a stray `owner`.
	const workspaceRoles =
		facts.organizationId === null && actorUserId !== facts.userId
			? parsedRoles.filter((role) => role !== "owner")
			: parsedRoles;
	const role = projectRoleOf({
		actorUserId,
		directRole: facts.directRole,
		projectOrganizationId: facts.organizationId,
		projectUserId: facts.userId,
		workspaceAccess: facts.workspaceAccess,
		workspaceRoles,
	});

	if (role === null) {
		return null;
	}

	return {
		directRole: facts.directRole,
		project: {
			engine: facts.engine,
			id: facts.id,
			organizationId: facts.organizationId,
			userId: facts.userId,
			workspaceAccess: facts.workspaceAccess,
		},
		role,
		workspace:
			facts.workspaceId === null || facts.workspaceName === null
				? null
				: {
						id: facts.workspaceId,
						kind:
							facts.workspacePersonalOwnerUserId === null ? "team" : "personal",
						name: facts.workspaceName,
						personalOwnerUserId: facts.workspacePersonalOwnerUserId,
					},
		workspaceRoles,
	};
}

/**
 * The `access` field of the Project contract. Null when the workspace row is
 * missing: the answer then leaves out `access`.
 */
export function projectAccessDto(
	access: ResolvedProjectAccess,
): ProjectAccess | null {
	if (access.workspace === null) {
		return null;
	}

	return {
		role: access.role,
		workspace: {
			id: access.workspace.id,
			kind: access.workspace.kind,
			name: access.workspace.name,
		},
		workspaceAccess: access.project.workspaceAccess,
	};
}

/**
 * Delete rule of `DELETE /api/v1/projects/:projectId` (design 2.2). A V2
 * project needs the role `owner`. A V1 project keeps the workspace rule
 * `project:delete`, checked against the role in the project's own workspace.
 */
export function canDeleteProject(access: ResolvedProjectAccess): boolean {
	if (access.project.engine === "v2_app") {
		return access.role === "owner";
	}

	// The personal owner holds every right in the own workspace, like personal scope.
	const isPersonalOwner =
		access.project.organizationId === null && access.role === "owner";

	return (
		isPersonalOwner ||
		workspaceRoleHasPermission(access.workspaceRoles.join(","), {
			project: ["delete"],
		})
	);
}

/** Rule 2: the role that the workspace membership gives, before the direct grant. */
function workspaceRoleOf(facts: ProjectRoleFacts): ProjectRole | null {
	// Restricted: only the owner (rule 1) and direct grants open the project.
	if (facts.workspaceAccess === "restricted") {
		return null;
	}

	if (facts.workspaceRoles.includes("admin")) {
		return "admin";
	}

	// A workspace Editor (`member`) edits only when Workspace access is Can edit.
	if (facts.workspaceRoles.includes("member")) {
		return facts.workspaceAccess === "can_edit" ? "editor" : "viewer";
	}

	return facts.workspaceRoles.includes("viewer") ? "viewer" : null;
}
