/**
 * `/api/v2/projects/:projectId/publish`: the Worker publish of one V2 web
 * app (WANDIT-178). The global AuthGuard needs a session, `V2BuilderEnabledGuard`
 * gates the module, the workspace guard checks `publish:manage` on the
 * writes like the V1 routes, and `RedisRateLimitGuard` reads `@RateLimit`.
 * This file parses the input and delegates to `PublishService`.
 */
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AppBuild,
	type AppPublishStatus,
	type PublishAppBody,
	publishAppBodySchema,
	type RollbackAppBody,
	rollbackAppBodySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { PublishService } from "../../../application/services/publish.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

// 10 writes per user in 10 minutes (ESTIMATE). Each publish wakes a sandbox
// and runs a build, so the cap stops a script that publishes in a loop.
// Each route has its own bucket.
const PUBLISH_MUTATION_LIMIT = 10;
const PUBLISH_MUTATION_WINDOW_MS = 600_000;

const projectIdParam = Param("projectId", new ZodValidationPipe(uuidSchema));

/** The publish routes of the V2 app builder (the web body of the publish popover). */
@Controller("v2/projects/:projectId/publish")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class PublishController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(PublishService)
		private readonly publish: Pick<
			PublishService,
			"publishHead" | "rollback" | "status" | "unpublish"
		>,
	) {}

	// Any member reads the state, like the V1 `deployments/current` route.
	@Get()
	status(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<AppPublishStatus> {
		return this.publish.status(projectScopeFrom(workspace, user.id), projectId);
	}

	// 202: the build runs in the task. The popover polls the status.
	@RequireWorkspacePermission("publish", "manage")
	@RateLimit({
		key: "app-publish",
		limit: PUBLISH_MUTATION_LIMIT,
		windowMs: PUBLISH_MUTATION_WINDOW_MS,
	})
	@Post()
	@HttpCode(202)
	publishHead(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(publishAppBodySchema)) body: PublishAppBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<AppBuild> {
		return this.publish.publishHead(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
		);
	}

	@RequireWorkspacePermission("publish", "manage")
	@RateLimit({
		key: "app-publish-rollback",
		limit: PUBLISH_MUTATION_LIMIT,
		windowMs: PUBLISH_MUTATION_WINDOW_MS,
	})
	@Post("rollback")
	@HttpCode(202)
	rollback(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(rollbackAppBodySchema)) body: RollbackAppBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<AppBuild> {
		return this.publish.rollback(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
		);
	}

	@RequireWorkspacePermission("publish", "manage")
	@RateLimit({
		key: "app-unpublish",
		limit: PUBLISH_MUTATION_LIMIT,
		windowMs: PUBLISH_MUTATION_WINDOW_MS,
	})
	@Delete()
	unpublish(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<AppPublishStatus> {
		return this.publish.unpublish(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}
}
