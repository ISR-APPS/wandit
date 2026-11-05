/**
 * Route decorators of project access: @RequireProjectRole and @CurrentProjectAccess.
 * Controllers put them on `:projectId` routes. ProjectAccessGuard reads the metadata,
 * resolves the access, and attaches it to the request.
 */
import {
	createParamDecorator,
	type ExecutionContext,
	InternalServerErrorException,
	SetMetadata,
} from "@nestjs/common";
import type { ProjectRole } from "@wandit/contracts";

import type { MaybeAuthenticatedRequest } from "../../../../auth";
import type { ResolvedProjectAccess } from "../../../domain/project-access";

/** A request after ProjectAccessGuard. `projectAccess` is set only on routes with @RequireProjectRole. */
export type MaybeProjectAccessRequest = MaybeAuthenticatedRequest & {
	projectAccess?: ResolvedProjectAccess;
};

/** What a route asks of the caller's project role. */
export type ProjectRoleRequirement = {
	/** The lowest effective role that may call the route. */
	role: ProjectRole;
	/** True on the V1 `/projects/:projectId` routes. Else a project that is not `v2_app` answers 404. */
	anyEngine: boolean;
};

/** Metadata key of @RequireProjectRole. ProjectAccessGuard and the controller specs read it. */
export const PROJECT_ROLE_KEY = Symbol("PROJECT_ROLE_KEY");

/**
 * Gates a `:projectId` route by the caller's role on that project (design 2.2).
 * No role answers 404, a lower role answers 403. The header role never decides.
 */
export const RequireProjectRole = (
	role: ProjectRole,
	options: { anyEngine?: boolean } = {},
) =>
	SetMetadata(PROJECT_ROLE_KEY, {
		anyEngine: options.anyEngine ?? false,
		role,
	} satisfies ProjectRoleRequirement);

/** The access that ProjectAccessGuard resolved. Use it only with @RequireProjectRole. */
export const CurrentProjectAccess = createParamDecorator<
	undefined,
	ResolvedProjectAccess
>((_data, context: ExecutionContext) => {
	const request = context
		.switchToHttp()
		.getRequest<MaybeProjectAccessRequest>();

	if (!request.projectAccess) {
		// A wiring bug: the route has no @RequireProjectRole, so no guard resolved access.
		throw new InternalServerErrorException(
			"CurrentProjectAccess used without @RequireProjectRole",
		);
	}

	return request.projectAccess;
});
