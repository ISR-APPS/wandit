/**
 * Global guard that turns the x-wandit-workspace header into a WorkspaceContext.
 * Nest runs it on every non-public request, after AuthGuard.
 * It reads members through WorkspaceMembersRepository and checks the route's workspace decorators.
 */
import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
	type WorkspacePermissionRequest,
	workspaceRoleHasPermission,
} from "@wandit/auth/permissions";
import { PERSONAL_WORKSPACE, WORKSPACE_HEADER } from "@wandit/contracts";

import { IS_PUBLIC_KEY } from "../../../../auth/presentation/http/decorators/public.decorator";
import {
	WorkspaceNotSupportedError,
	WorkspacePermissionDeniedError,
} from "../../../domain/errors/workspace.errors";
import {
	PERSONAL_WORKSPACE_CONTEXT,
	parseWorkspaceRoles,
	type WorkspaceContext,
} from "../../../domain/workspace-context";
import { WorkspaceMembersRepository } from "../../../infrastructure/persistence/members.repository";
import {
	PERSONAL_WORKSPACE_ONLY_KEY,
	WORKSPACE_PERMISSION_KEY,
	type WorkspacePermissionRequirement,
} from "../decorators/workspace.decorators";
import type { MaybeWorkspaceScopedRequest } from "../types/workspace-request";

/**
 * Resolves the request's workspace scope from the x-wandit-workspace header —
 * the single scope authority (teams-workspaces.md §2) — and enforces the
 * route's workspace decorators. The header maps to a kind as in
 * workspaces-sharing.md 3.1: see WorkspaceContext.
 *
 * Registered as a global guard AFTER AuthGuard (module import order in
 * AppModule): it needs request.user. @Public routes are skipped entirely —
 * they have no user and must not act on org data.
 *
 * Non-members get 404, not 403: same information-hiding posture as project
 * ownership (the org id must not be probeable).
 */
@Injectable()
export class WorkspaceContextGuard implements CanActivate {
	constructor(
		@Inject(WorkspaceMembersRepository)
		private readonly members: WorkspaceMembersRepository,
		@Inject(Reflector)
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		const request = context
			.switchToHttp()
			.getRequest<MaybeWorkspaceScopedRequest>();
		const user = request.user;

		if (!user) {
			// AuthGuard rejects unauthenticated non-public requests before this
			// guard runs; a missing user here means guard mis-ordering.
			throw new NotFoundException();
		}

		const workspace = await this.resolveWorkspace(request, user.id);
		request.workspace = workspace;

		this.enforceRouteRequirements(context, workspace);

		return true;
	}

	private async resolveWorkspace(
		request: MaybeWorkspaceScopedRequest,
		userId: string,
	): Promise<WorkspaceContext> {
		const raw = request.headers[WORKSPACE_HEADER];
		const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();

		if (!value || value === PERSONAL_WORKSPACE) {
			return PERSONAL_WORKSPACE_CONTEXT;
		}

		const membership = await this.members.findMembership(value, userId);

		if (!membership) {
			throw new NotFoundException();
		}

		// The own personal org id is the same scope as no header: the owner's
		// projects keep organization_id NULL and the personal pool pays.
		if (membership.personalOwnerUserId === userId) {
			return PERSONAL_WORKSPACE_CONTEXT;
		}

		if (membership.personalOwnerUserId !== null) {
			return {
				kind: "shared-personal",
				organizationId: membership.organizationId,
				ownerUserId: membership.personalOwnerUserId,
				role: membership.role,
				roles: parseWorkspaceRoles(membership.role),
			};
		}

		return {
			kind: "org",
			organizationId: membership.organizationId,
			role: membership.role,
			roles: parseWorkspaceRoles(membership.role),
		};
	}

	private enforceRouteRequirements(
		context: ExecutionContext,
		workspace: WorkspaceContext,
	): void {
		const targets = [context.getHandler(), context.getClass()];

		// Legacy personal-only routes debit the caller's own pool, so another
		// user's personal workspace is refused like a team workspace.
		if (
			this.reflector.getAllAndOverride<boolean>(
				PERSONAL_WORKSPACE_ONLY_KEY,
				targets,
			) &&
			workspace.kind !== "personal"
		) {
			throw new WorkspaceNotSupportedError(
				"This operation is only available in your personal workspace",
			);
		}

		const requirement =
			this.reflector.getAllAndOverride<WorkspacePermissionRequirement>(
				WORKSPACE_PERMISSION_KEY,
				targets,
			);

		// Personal scope bypasses role checks: users are omnipotent in their own
		// workspace. Role gates only exist between workspace members.
		if (!requirement || workspace.kind === "personal") {
			return;
		}

		// The money of a shared personal workspace is the owner's personal
		// pool: only the owner, in personal scope, manages billing and limits.
		if (
			workspace.kind === "shared-personal" &&
			(requirement.resource === "billing" || requirement.resource === "limits")
		) {
			throw new WorkspacePermissionDeniedError();
		}

		const permitted = workspaceRoleHasPermission(workspace.role, {
			[requirement.resource]: requirement.actions,
		} as WorkspacePermissionRequest);

		if (!permitted) {
			throw new WorkspacePermissionDeniedError();
		}
	}
}
