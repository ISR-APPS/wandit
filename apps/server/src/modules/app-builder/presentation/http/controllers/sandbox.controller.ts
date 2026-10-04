/**
 * `POST /api/v2/projects/:projectId/sandbox/wake`: boots a sleeping project
 * sandbox without a builder turn, so the preview needs no paid message.
 * The global AuthGuard requires a session; `V2BuilderEnabledGuard` gates
 * the route and `RedisRateLimitGuard` reads the `@RateLimit` metadata.
 * Scope, lock, and boot live in `SandboxWakeService`.
 */
import {
	Controller,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type SandboxWakeResponse, uuidSchema } from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { SandboxWakeService } from "../../../application/services/sandbox-wake.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/** The sandbox routes of the V2 app builder. */
@Controller("v2/projects/:projectId/sandbox")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class SandboxController {
	constructor(
		@Inject(SandboxWakeService)
		private readonly sandboxWake: Pick<SandboxWakeService, "wake">,
	) {}

	// A wake costs sandbox minutes like a turn, so an org member needs the
	// right of a turn. It charges no credits, so a small bucket bounds the
	// cost: 6 wakes per user per 10 minutes.
	@RequireWorkspacePermission("project", "update")
	@RateLimit({ key: "sandbox-wake", limit: 6, windowMs: 10 * 60_000 })
	@Post("wake")
	@HttpCode(HttpStatus.ACCEPTED)
	wake(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<SandboxWakeResponse> {
		return this.sandboxWake.wake(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}
}
