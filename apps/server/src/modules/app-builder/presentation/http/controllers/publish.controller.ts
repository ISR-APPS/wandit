/**
 * `/api/v2/projects/:projectId/publish`: the Worker publish of one V2 web
 * app (WANDIT-178). The global AuthGuard needs a session, `V2BuilderEnabledGuard`
 * gates the module, the global ProjectAccessGuard checks the project role,
 * and `RedisRateLimitGuard` reads `@RateLimit`.
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
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { PublishService } from "../../../application/services/publish.service";
import {
	APP_PUBLISH_RATE_LIMIT,
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

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

	// Any project viewer reads the state, like the V1 `deployments/current` route.
	@RequireProjectRole("viewer")
	@Get()
	status(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<AppPublishStatus> {
		return this.publish.status(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// 202: the build runs in the task. The popover polls the status.
	@RequireProjectRole("editor")
	@RateLimit(APP_PUBLISH_RATE_LIMIT)
	@Post()
	@HttpCode(202)
	publishHead(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(publishAppBodySchema)) body: PublishAppBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<AppBuild> {
		return this.publish.publishHead(
			projectScopeFromAccess(access, user.id),
			projectId,
			body,
		);
	}

	@RequireProjectRole("editor")
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
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<AppBuild> {
		return this.publish.rollback(
			projectScopeFromAccess(access, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}

	// "Publish anyway" is a publish, so it shares the publish bucket: the
	// override cannot get around the publish cap. Product rule (WANDIT-190):
	// only the project owner takes the risk of an open table.
	@RequireProjectRole("owner")
	@RateLimit(APP_PUBLISH_RATE_LIMIT)
	@Post("override")
	@HttpCode(202)
	overrideGate(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(overridePublishGateBodySchema))
		body: OverridePublishGateBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<AppBuild> {
		return this.publish.overrideGate(
			projectScopeFromAccess(access, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}

	@RequireProjectRole("editor")
	@RateLimit({
		key: "app-unpublish",
		limit: ROLLBACK_UNPUBLISH_LIMIT,
		windowMs: ROLLBACK_UNPUBLISH_WINDOW_MS,
	})
	@Delete()
	unpublish(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<AppPublishStatus> {
		return this.publish.unpublish(
			projectScopeFromAccess(access, user.id),
			projectId,
			readClientIp(request),
		);
	}
}
