/**
 * `/api/v2/projects/:projectId/publish`: the Worker publish of one V2 web
 * app (WANDIT-178). The global AuthGuard needs a session, `V2BuilderEnabledGuard`
 * gates the module, the workspace guard checks `publish:manage` on the
 * writes like the V1 routes, and `RedisRateLimitGuard` reads `@RateLimit`.
 * This file parses the input, reads the client IP for the audit rows, and
 * delegates to `PublishService`.
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
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AppBuild,
	type AppPublishStatus,
	type OverridePublishGateBody,
	overridePublishGateBodySchema,
	type PublishAppBody,
	publishAppBodySchema,
	type RollbackAppBody,
	rollbackAppBodySchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readClientIp } from "../../../../../infrastructure/http/client-ip";
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

// 10 publishes per user per hour (WANDIT-181). Each publish wakes a sandbox
// and runs a build, so the cap stops a script that publishes in a loop.
const PUBLISH_LIMIT = 10;
// Publishes per client IP per hour. The cap stops one person who uses many
// accounts. An event room shares one NAT IP, so staging sizes it for the room.
// LIMIT: one NAT IP fits about 100 people with 3 publishes each. Upgrade: skip the IP cap for known event IPs.
// STAGING ONLY: restore the production values before a merge to main (docs/v2/runbook.md).
const PUBLISH_IP_LIMIT = 300;
const PUBLISH_WINDOW_MS = 60 * 60_000;

// 10 rollbacks or unpublishes per user in 10 minutes (ESTIMATE). Each one
// uploads or deletes the user Worker, so the cap stops a script that flips
// the live app in a loop. Each route has its own bucket.
const ROLLBACK_UNPUBLISH_LIMIT = 10;
const ROLLBACK_UNPUBLISH_WINDOW_MS = 600_000;

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
			"overrideGate" | "publishHead" | "rollback" | "status" | "unpublish"
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
		ipLimit: PUBLISH_IP_LIMIT,
		key: "app-publish",
		limit: PUBLISH_LIMIT,
		windowMs: PUBLISH_WINDOW_MS,
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
		limit: ROLLBACK_UNPUBLISH_LIMIT,
		windowMs: ROLLBACK_UNPUBLISH_WINDOW_MS,
	})
	@Post("rollback")
	@HttpCode(202)
	rollback(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(rollbackAppBodySchema)) body: RollbackAppBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<AppBuild> {
		return this.publish.rollback(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}

	// "Publish anyway" is a publish, so it shares the publish bucket: the
	// override cannot get around the publish cap.
	@RequireWorkspacePermission("publish", "manage")
	@RateLimit({
		ipLimit: PUBLISH_IP_LIMIT,
		key: "app-publish",
		limit: PUBLISH_LIMIT,
		windowMs: PUBLISH_WINDOW_MS,
	})
	@Post("override")
	@HttpCode(202)
	overrideGate(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(overridePublishGateBodySchema))
		body: OverridePublishGateBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<AppBuild> {
		return this.publish.overrideGate(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}

	@RequireWorkspacePermission("publish", "manage")
	@RateLimit({
		key: "app-unpublish",
		limit: ROLLBACK_UNPUBLISH_LIMIT,
		windowMs: ROLLBACK_UNPUBLISH_WINDOW_MS,
	})
	@Delete()
	unpublish(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<AppPublishStatus> {
		return this.publish.unpublish(
			projectScopeFrom(workspace, user.id),
			projectId,
			readClientIp(request),
		);
	}
}
