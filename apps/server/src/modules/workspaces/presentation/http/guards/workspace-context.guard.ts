import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
	workspaceRoleHasPermission,
	type WorkspacePermissionRequest,
} from "@wandit/auth/permissions";
import {
	PERSONAL_WORKSPACE,
	WORKSPACE_HEADER,
	workspaceRoleNames,
	type WorkspaceRoleName,
} from "@wandit/contracts";

import { IS_PUBLIC_KEY } from "../../../../auth/presentation/http/decorators/public.decorator";
import {
	WorkspaceNotSupportedError,
	WorkspacePermissionDeniedError,
} from "../../../domain/errors/workspace.errors";
import {
	PERSONAL_WORKSPACE_CONTEXT,
	type WorkspaceContext,
} from "../../../domain/workspace-context";
import { WorkspaceMembersRepository } from "../../../infrastructure/persistence/members.repository";
import {
	ORG_WORKSPACE_REQUIRED_KEY,
	PERSONAL_WORKSPACE_ONLY_KEY,
	WORKSPACE_PERMISSION_KEY,
	type WorkspacePermissionRequirement,
} from "../decorators/workspace.decorators";
import type { MaybeWorkspaceScopedRequest } from "../types/workspace-request";

/**
 * Resolves the request's workspace scope from the x-wandit-workspace header —
 * the single scope authority (teams-workspaces.md §2) — and enforces the
 * route's workspace decorators.
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

		const member = await this.members.findMember(value, userId);

		if (!member) {
			throw new NotFoundException();
		}

		return {
			kind: "org",
			organizationId: member.organizationId,
			role: member.role,
			roles: parseKnownRoles(member.role),
		};
	}

	private enforceRouteRequirements(
		context: ExecutionContext,
		workspace: WorkspaceContext,
	): void {
		const targets = [context.getHandler(), context.getClass()];

		if (
			this.reflector.getAllAndOverride<boolean>(
				PERSONAL_WORKSPACE_ONLY_KEY,
				targets,
			) &&
			workspace.kind === "org"
		) {
			throw new WorkspaceNotSupportedError(
				"This operation is only available in your personal workspace",
			);
		}

		if (
			this.reflector.getAllAndOverride<boolean>(
				ORG_WORKSPACE_REQUIRED_KEY,
				targets,
			) &&
			workspace.kind !== "org"
		) {
			throw new WorkspaceNotSupportedError(
				"This operation requires a team workspace",
			);
		}

		const requirement =
			this.reflector.getAllAndOverride<WorkspacePermissionRequirement>(
				WORKSPACE_PERMISSION_KEY,
				targets,
			);

		// Personal scope bypasses role checks: users are omnipotent in their own
		// workspace. Role gates only exist between org members.
		if (!requirement || workspace.kind !== "org") {
			return;
		}

		const permitted = workspaceRoleHasPermission(workspace.role, {
			[requirement.resource]: requirement.actions,
		} as WorkspacePermissionRequest);

		if (!permitted) {
			throw new WorkspacePermissionDeniedError();
		}
	}
}

function parseKnownRoles(roleValue: string): WorkspaceRoleName[] {
	const known = new Set<string>(workspaceRoleNames);

	return roleValue
		.split(",")
		.map((name) => name.trim())
		.filter((name): name is WorkspaceRoleName => known.has(name));
}
