import { and, eq, isNull, type SQL } from "@wandit/db";
import { projects } from "@wandit/db/schema/projects";

import type { MeteringSubject } from "../../credits/domain/credit-owner";
import type { WorkspaceContext } from "../../workspaces/domain/workspace-context";

/**
 * The per-request authorization scope for project-rooted resources
 * (projects, chats, pages, sites, domains, assets, leads, generations).
 *
 * Personal: authorization is creator equality, byte-identical to pre-teams.
 * Org: authorization is workspace membership (already proven by the
 * WorkspaceContextGuard) — the creator column is provenance only. Role gates
 * layer at controllers via @RequireWorkspacePermission, never down here.
 */
export type ProjectScope =
	| { kind: "personal"; userId: string }
	| {
			kind: "org";
			organizationId: string;
			/** Acting member — the metering actor, never the authz subject. */
			userId: string;
			/** owner/admin bypass the org's DEFAULT member credit limit. */
			actorIsLimitExempt: boolean;
	  };

export function projectScopeFrom(
	workspace: WorkspaceContext | undefined,
	userId: string,
): ProjectScope {
	if (!workspace || workspace.kind !== "org") {
		return { kind: "personal", userId };
	}

	return {
		actorIsLimitExempt:
			workspace.roles.includes("owner") || workspace.roles.includes("admin"),
		kind: "org",
		organizationId: workspace.organizationId,
		userId,
	};
}

/** The drizzle predicate selecting the scope's projects. */
export function projectScopePredicate(scope: ProjectScope): SQL {
	const predicate =
		scope.kind === "personal"
			? and(
					eq(projects.userId, scope.userId),
					isNull(projects.organizationId),
				)
			: eq(projects.organizationId, scope.organizationId);

	if (!predicate) {
		throw new Error("Project scope predicate could not be constructed");
	}

	return predicate;
}

/** The pool that pays for work in this scope, plus the recorded actor. */
export function meteringSubjectFrom(scope: ProjectScope): MeteringSubject {
	return scope.kind === "personal"
		? { actorUserId: scope.userId }
		: {
				actorIsLimitExempt: scope.actorIsLimitExempt,
				actorUserId: scope.userId,
				organizationId: scope.organizationId,
			};
}

/** Column values for creating a project in this scope. */
export function projectOwnerColumns(scope: ProjectScope): {
	organizationId: string | null;
	userId: string;
} {
	return {
		organizationId: scope.kind === "org" ? scope.organizationId : null,
		userId: scope.userId,
	};
}
