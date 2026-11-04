/**
 * The per-request scope of project-rooted resources and the helpers that read it.
 * Controllers build it with projectScopeFrom from the workspace header context, or with
 * projectScopeFromAccess from the project row on `:projectId` routes.
 * Repositories filter with projectScopePredicate; metering reads meteringSubjectFrom.
 */
import type { WorkspaceRoleName } from "@wandit/contracts";
import { and, eq, isNull, ne, or, type SQL, sql } from "@wandit/db";
import { projectMembers } from "@wandit/db/schema/project-sharing";
import { projects } from "@wandit/db/schema/projects";

import type { MeteringSubject } from "../../credits/domain/credit-owner";
import type { WorkspaceContext } from "../../workspaces/domain/workspace-context";
import type { ResolvedProjectAccess } from "./project-access";

/**
 * The scope of project-rooted resources (projects, chats, pages, sites,
 * domains, assets, leads, generations), workspaces-sharing.md 3.2.
 *
 * It has no `userId` on purpose. Each reader picks the owner (authorization,
 * payer, owner columns) or the actor (attribution, analytics, uploads,
 * preview-token and device-session `uid`, per-person locks).
 * Role gates stay at the controllers: @RequireProjectRole on `:projectId`
 * routes, @RequireWorkspacePermission on the other routes.
 */
export type ProjectScope =
	| {
			kind: "personal";
			/** Owner of the personal workspace: `projects.user_id` of its projects and the payer. */
			ownerUserId: string;
			/** The signed-in caller. Equals `ownerUserId` in the caller's own workspace. */
			actorUserId: string;
			/**
			 * Workspace roles of the actor. `["owner"]` for the personal owner. A system
			 * scope also sets `["owner"]`, so the creator term of the Restricted filter applies.
			 */
			actorRoles: WorkspaceRoleName[];
			/**
			 * True for the personal owner: it skips the DEFAULT member credit limit.
			 * A system scope takes the value from its caller.
			 */
			actorIsLimitExempt: boolean;
	  }
	| {
			kind: "org";
			organizationId: string;
			/** The acting member: the metering actor and the creator of new rows. */
			actorUserId: string;
			/**
			 * Workspace roles of the actor in this team workspace. A system scope sets
			 * `["owner"]`, so the Restricted filter does not hide the project.
			 */
			actorRoles: WorkspaceRoleName[];
			/**
			 * Owners and admins skip the org's DEFAULT member credit limit.
			 * A system scope takes the value from its caller.
			 */
			actorIsLimitExempt: boolean;
	  };

/**
 * Builds the scope from the header context. Another user's personal workspace
 * gives `personal` with that user as the owner, so the owner's pool pays.
 */
export function projectScopeFrom(
	workspace: WorkspaceContext | undefined,
	userId: string,
): ProjectScope {
	if (!workspace || workspace.kind === "personal") {
		return {
			actorIsLimitExempt: true,
			actorRoles: ["owner"],
			actorUserId: userId,
			kind: "personal",
			ownerUserId: userId,
		};
	}

	if (workspace.kind === "shared-personal") {
		// The money is the owner's, so only the owner skips the default limit.
		return {
			actorIsLimitExempt: false,
			actorRoles: workspace.roles,
			actorUserId: userId,
			kind: "personal",
			ownerUserId: workspace.ownerUserId,
		};
	}

	return {
		actorIsLimitExempt:
			workspace.roles.includes("owner") || workspace.roles.includes("admin"),
		actorRoles: workspace.roles,
		actorUserId: userId,
		kind: "org",
		organizationId: workspace.organizationId,
	};
}

/**
 * Builds the scope of a `:projectId` route from the project row, never from the
 * header (design 3.3). A team project gives `org` with the project's org. A
 * personal project gives `personal` with `projects.user_id` as the owner and payer.
 */
export function projectScopeFromAccess(
	access: ResolvedProjectAccess,
	actorUserId: string,
): ProjectScope {
	const { project, workspaceRoles } = access;

	if (project.organizationId === null) {
		const isOwner = actorUserId === project.userId;

		// The money is the owner's, so only the owner skips the default limit.
		return {
			actorIsLimitExempt: isOwner,
			actorRoles: isOwner ? ["owner"] : workspaceRoles,
			actorUserId,
			kind: "personal",
			ownerUserId: project.userId,
		};
	}

	return {
		actorIsLimitExempt:
			workspaceRoles.includes("owner") || workspaceRoles.includes("admin"),
		actorRoles: workspaceRoles,
		actorUserId,
		kind: "org",
		organizationId: project.organizationId,
	};
}

/**
 * The scope of work that an earlier request already authorized: a Trigger task,
 * a host tool, a staff tool, a script. It reads the owner columns of the project
 * row. A task holds no workspace roles, so `actorRoles` is `["owner"]`. Thus the
 * Restricted filter never hides a team project. On a personal project the filter
 * is off only when the actor is the owner. The caller picks `actorIsLimitExempt`.
 */
export function systemProjectScope(
	project: {
		/** `projects.user_id` (the owner of a personal project), or the owner column of a child row. */
		userId: string;
		/** `projects.organization_id`; null for a personal project. */
		organizationId: string | null;
	},
	actorUserId: string,
	actorIsLimitExempt: boolean,
): ProjectScope {
	return project.organizationId === null
		? {
				actorIsLimitExempt,
				actorRoles: ["owner"],
				actorUserId,
				kind: "personal",
				ownerUserId: project.userId,
			}
		: {
				actorIsLimitExempt,
				actorRoles: ["owner"],
				actorUserId,
				kind: "org",
				organizationId: project.organizationId,
			};
}

/**
 * The drizzle predicate that selects the scope's projects. It also applies the
 * Restricted rule of `projectRoleOf` (workspaces-sharing.md 2.2), so a
 * header-scoped list never shows a project the actor cannot open.
 */
export function projectScopePredicate(scope: ProjectScope): SQL {
	const workspacePredicate =
		scope.kind === "personal"
			? and(
					eq(projects.userId, scope.ownerUserId),
					isNull(projects.organizationId),
				)
			: eq(projects.organizationId, scope.organizationId);
	// The workspace owner opens every project, Restricted ones too.
	const predicate = actorIsWorkspaceOwner(scope)
		? workspacePredicate
		: and(workspacePredicate, restrictedAccessPredicate(scope));

	if (!predicate) {
		throw new Error("Project scope predicate could not be constructed");
	}

	return predicate;
}

/**
 * The pool that pays for work in this scope, plus the recorded actor.
 * `payerUserId` is set only when another user's personal pool pays.
 */
export function meteringSubjectFrom(scope: ProjectScope): MeteringSubject {
	if (scope.kind === "org") {
		return {
			actorIsLimitExempt: scope.actorIsLimitExempt,
			actorUserId: scope.actorUserId,
			organizationId: scope.organizationId,
		};
	}

	return {
		actorIsLimitExempt: scope.actorIsLimitExempt,
		actorUserId: scope.actorUserId,
		...(scope.ownerUserId === scope.actorUserId
			? {}
			: { payerUserId: scope.ownerUserId }),
	};
}

/**
 * Column values for a project created in this scope. In a personal workspace
 * the owner owns every project, also one that a member creates.
 */
export function projectOwnerColumns(scope: ProjectScope): {
	organizationId: string | null;
	userId: string;
} {
	return scope.kind === "personal"
		? { organizationId: null, userId: scope.ownerUserId }
		: { organizationId: scope.organizationId, userId: scope.actorUserId };
}

/** The team `owner` role, or the owner of the personal workspace. */
function actorIsWorkspaceOwner(scope: ProjectScope): boolean {
	return scope.kind === "personal"
		? scope.actorUserId === scope.ownerUserId
		: scope.actorRoles.includes("owner");
}

/**
 * A non-owner sees a Restricted project only as its creator (with a role other
 * than viewer) or through a `project_members` row. Same rule as `projectRoleOf`.
 */
function restrictedAccessPredicate(scope: ProjectScope): SQL | undefined {
	const hasDirectGrant = sql`exists (select 1 from ${projectMembers} where ${projectMembers.projectId} = ${projects.id} and ${projectMembers.userId} = ${scope.actorUserId})`;
	// A creator who was downgraded to viewer loses the creator term.
	const isEditingCreator = scope.actorRoles.some((role) => role !== "viewer")
		? eq(projects.userId, scope.actorUserId)
		: undefined;

	return or(
		ne(projects.workspaceAccess, "restricted"),
		isEditingCreator,
		hasDirectGrant,
	);
}
