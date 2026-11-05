/**
 * `/api/v2/projects/:projectId/desktop`: the desktop builds and releases of
 * one V2 desktop app (docs/v2/desktop-apps.md section 8). The global
 * AuthGuard needs a session, the workspace guard checks `project:update` on
 * the POST routes, `V2BuilderEnabledGuard` gates the module, and
 * `RedisRateLimitGuard` reads the `@RateLimit` of the writes. This file
 * parses the input and delegates to `DesktopBuildsService`.
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
	type CreateDesktopBuildBody,
	createDesktopBuildBodySchema,
	type DesktopBuild,
	type DesktopOverviewQuery,
	type DesktopOverviewResponse,
	desktopOverviewQuerySchema,
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
import { DesktopBuildsService } from "../../../application/services/desktop-builds.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

// 10 writes per user in 10 minutes (ESTIMATE). A project runs one build at
// a time, so a real user needs few. The cap stops a script that starts and
// cancels desktop builds in a loop. Each route has its own bucket.
const DESKTOP_MUTATION_LIMIT = 10;
const DESKTOP_MUTATION_WINDOW_MS = 600_000;

const projectIdParam = Param("projectId", new ZodValidationPipe(uuidSchema));
const buildIdParam = Param("buildId", new ZodValidationPipe(uuidSchema));

/** The desktop routes of the V2 app builder (the Release popover of a desktop project). */
@Controller("v2/projects/:projectId/desktop")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class DesktopBuildsController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(DesktopBuildsService)
		private readonly desktop: Pick<
			DesktopBuildsService,
			"cancel" | "create" | "overview" | "release"
		>,
	) {}

	// A member of the workspace may read. The service answers 404 for a
	// project of another workspace.
	@Get()
	overview(
		@projectIdParam projectId: string,
		@Query(new ZodValidationPipe(desktopOverviewQuerySchema))
		query: DesktopOverviewQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<DesktopOverviewResponse> {
		return this.desktop.overview(
			projectScopeFrom(workspace, user.id),
			projectId,
			query,
		);
	}

	// A build spends credits and ships the app code, so it needs `project:update`.
	@RequireWorkspacePermission("project", "update")
	@RateLimit({
		key: "desktop-build-create",
		limit: DESKTOP_MUTATION_LIMIT,
		windowMs: DESKTOP_MUTATION_WINDOW_MS,
	})
	@Post("builds")
	create(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(createDesktopBuildBodySchema))
		body: CreateDesktopBuildBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<DesktopBuild> {
		return this.desktop.create(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}

	// Idempotent: a build that already ended, or that signs, answers as it is, so 200 and not 201.
	@RequireWorkspacePermission("project", "update")
	@RateLimit({
		key: "desktop-build-cancel",
		limit: DESKTOP_MUTATION_LIMIT,
		windowMs: DESKTOP_MUTATION_WINDOW_MS,
	})
	@Post("builds/:buildId/cancel")
	@HttpCode(200)
	cancel(
		@projectIdParam projectId: string,
		@buildIdParam buildId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<DesktopBuild> {
		return this.desktop.cancel(
			projectScopeFrom(workspace, user.id),
			projectId,
			buildId,
			readClientIp(request),
		);
	}

	// A release changes what every installed app downloads next, so it
	// needs `project:update`. A repeat of the same release is safe: 200.
	@RequireWorkspacePermission("project", "update")
	@RateLimit({
		key: "desktop-build-release",
		limit: DESKTOP_MUTATION_LIMIT,
		windowMs: DESKTOP_MUTATION_WINDOW_MS,
	})
	@Post("builds/:buildId/release")
	@HttpCode(200)
	release(
		@projectIdParam projectId: string,
		@buildIdParam buildId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<DesktopBuild> {
		return this.desktop.release(
			projectScopeFrom(workspace, user.id),
			projectId,
			buildId,
			readClientIp(request),
		);
	}
}
