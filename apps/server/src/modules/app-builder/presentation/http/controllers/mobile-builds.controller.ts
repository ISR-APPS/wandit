/**
 * `/api/v2/projects/:projectId/mobile-builds`: the EAS builds of one V2
 * mobile app (WANDIT-194). The global AuthGuard needs a session, the
 * workspace guard checks `project:update`, `V2BuilderEnabledGuard` gates the
 * module, and `RedisRateLimitGuard` reads the `@RateLimit` of the two write
 * routes. This file parses the input and delegates to `MobileBuildsService`.
 */
import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateMobileBuildBody,
	createMobileBuildBodySchema,
	type ListMobileBuildsQuery,
	type ListMobileBuildsResponse,
	listMobileBuildsQuerySchema,
	type MobileBuild,
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
import { MobileBuildsService } from "../../../application/services/mobile-builds.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

// 10 writes per user in 10 minutes (ESTIMATE). A project runs one build at
// a time, so a real user needs few. The cap stops a script that starts and
// cancels EAS builds in a loop. Each route has its own bucket.
const MOBILE_BUILD_MUTATION_LIMIT = 10;
const MOBILE_BUILD_MUTATION_WINDOW_MS = 600_000;

const projectIdParam = Param("projectId", new ZodValidationPipe(uuidSchema));
const buildIdParam = Param("buildId", new ZodValidationPipe(uuidSchema));

/** The mobile build routes of the V2 app builder (the Android card of the publish popover). */
@Controller("v2/projects/:projectId/mobile-builds")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
// A build spends credits and ships the app code, so reads and writes need
// `project:update`. A non-member gets 404 from the service.
@RequireWorkspacePermission("project", "update")
export class MobileBuildsController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(MobileBuildsService)
		private readonly builds: Pick<
			MobileBuildsService,
			"cancel" | "create" | "get" | "list"
		>,
	) {}

	@Get()
	list(
		@projectIdParam projectId: string,
		@Query(new ZodValidationPipe(listMobileBuildsQuerySchema))
		query: ListMobileBuildsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListMobileBuildsResponse> {
		return this.builds.list(
			projectScopeFrom(workspace, user.id),
			projectId,
			query,
		);
	}

	@RateLimit({
		key: "mobile-build-create",
		limit: MOBILE_BUILD_MUTATION_LIMIT,
		windowMs: MOBILE_BUILD_MUTATION_WINDOW_MS,
	})
	@Post()
	create(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(createMobileBuildBodySchema))
		body: CreateMobileBuildBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<MobileBuild> {
		return this.builds.create(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}

	@Get(":buildId")
	get(
		@projectIdParam projectId: string,
		@buildIdParam buildId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<MobileBuild> {
		return this.builds.get(
			projectScopeFrom(workspace, user.id),
			projectId,
			buildId,
		);
	}

	// Idempotent: a build that already ended answers as it is, so 200 and not 201.
	@RateLimit({
		key: "mobile-build-cancel",
		limit: MOBILE_BUILD_MUTATION_LIMIT,
		windowMs: MOBILE_BUILD_MUTATION_WINDOW_MS,
	})
	@Post(":buildId/cancel")
	@HttpCode(200)
	cancel(
		@projectIdParam projectId: string,
		@buildIdParam buildId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<MobileBuild> {
		return this.builds.cancel(
			projectScopeFrom(workspace, user.id),
			projectId,
			buildId,
			readClientIp(request),
		);
	}
}
