import {
	createParamDecorator,
	type ExecutionContext,
	SetMetadata,
} from "@nestjs/common";

import { PERSONAL_WORKSPACE_CONTEXT } from "../../../domain/workspace-context";
import type { MaybeWorkspaceScopedRequest } from "../types/workspace-request";

/**
 * Resolved workspace scope for the request. Falls back to personal for
 * routes the WorkspaceContextGuard skipped (e.g. @Public) — those must not
 * act on org data anyway.
 */
export const CurrentWorkspace = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => {
		const request = context
			.switchToHttp()
			.getRequest<MaybeWorkspaceScopedRequest>();

		return request.workspace ?? PERSONAL_WORKSPACE_CONTEXT;
	},
);

export type WorkspacePermissionRequirement = {
	resource:
		| "project"
		| "publish"
		| "domain"
		| "billing"
		| "limits"
		| "member"
		| "invitation";
	actions: readonly string[];
};

export const WORKSPACE_PERMISSION_KEY = Symbol("WORKSPACE_PERMISSION_KEY");

/**
 * Role-gate a route WHEN the request is org-scoped. Personal scope bypasses
 * role checks entirely (a user is omnipotent in their own workspace).
 * Enforced by WorkspaceContextGuard against the shared role matrix.
 */
export const RequireWorkspacePermission = (
	resource: WorkspacePermissionRequirement["resource"],
	...actions: string[]
) =>
	SetMetadata(WORKSPACE_PERMISSION_KEY, {
		actions,
		resource,
	} satisfies WorkspacePermissionRequirement);

export const ORG_WORKSPACE_REQUIRED_KEY = Symbol("ORG_WORKSPACE_REQUIRED_KEY");

/** Routes that only make sense inside an org workspace (e.g. member limits). */
export const RequireOrgWorkspace = () =>
	SetMetadata(ORG_WORKSPACE_REQUIRED_KEY, true);

export const PERSONAL_WORKSPACE_ONLY_KEY = Symbol(
	"PERSONAL_WORKSPACE_ONLY_KEY",
);

/**
 * Routes that predate workspaces and stay personal-only (legacy generation
 * endpoints): an org workspace header is rejected with a typed 400 rather
 * than silently debiting the member's personal pool.
 */
export const PersonalWorkspaceOnly = () =>
	SetMetadata(PERSONAL_WORKSPACE_ONLY_KEY, true);
