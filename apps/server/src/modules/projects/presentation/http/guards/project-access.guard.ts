/**
 * Global guard of `:projectId` routes: it checks the caller's role on the project (design 3.3).
 * WorkspacesModule registers it right after WorkspaceContextGuard, so request.user is set.
 * It reads @RequireProjectRole, calls ProjectAccessService, and attaches the access to the request.
 */
import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { uuidSchema } from "@wandit/contracts";
import { z } from "zod";

import { WorkspacePermissionDeniedError } from "../../../../workspaces/domain/errors/workspace.errors";
import { ProjectAccessService } from "../../../application/services/project-access.service";
import { projectRoleAtLeast } from "../../../domain/project-access";
import {
	type MaybeProjectAccessRequest,
	PROJECT_ROLE_KEY,
	type ProjectRoleRequirement,
} from "../decorators/project-access.decorators";

// Fastify route params, untrusted until parsed.
const projectRouteParamsSchema = z.object({ projectId: uuidSchema });

/**
 * Routes without @RequireProjectRole pass untouched. On a route with it:
 * no access, a deleted project, a bad id, or a V1 project on a V2 route
 * answer 404 (the id must not be probeable); a lower role answers 403.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
	constructor(
		@Inject(ProjectAccessService)
		private readonly projectAccess: Pick<ProjectAccessService, "resolve">,
		@Inject(Reflector)
		private readonly reflector: Pick<Reflector, "getAllAndOverride">,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const requirement = this.reflector.getAllAndOverride<
			ProjectRoleRequirement | undefined
		>(PROJECT_ROLE_KEY, [context.getHandler(), context.getClass()]);

		if (!requirement) {
			return true;
		}

		const request = context
			.switchToHttp()
			.getRequest<MaybeProjectAccessRequest>();
		const params = projectRouteParamsSchema.safeParse(request.params);

		// AuthGuard runs first, so a missing user means guard mis-ordering: fail closed.
		if (!request.user || !params.success) {
			throw new NotFoundException();
		}

		const access = await this.projectAccess.resolve(
			request.user.id,
			params.data.projectId,
		);

		// Sharing is for V2 apps only (design 0.4), so V2 routes hide V1 projects.
		if (
			access === null ||
			(!requirement.anyEngine && access.project.engine !== "v2_app")
		) {
			throw new NotFoundException();
		}

		if (!projectRoleAtLeast(access.role, requirement.role)) {
			throw new WorkspacePermissionDeniedError();
		}

		request.projectAccess = access;
		return true;
	}
}
