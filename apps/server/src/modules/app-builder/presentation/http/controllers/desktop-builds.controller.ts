/**
 * `/api/v2/projects/:projectId/desktop`: the desktop builds and releases of
 * one V2 desktop app (docs/v2/desktop-apps.md section 8). The global
 * AuthGuard needs a session, the global ProjectAccessGuard checks the editor
 * role, `V2BuilderEnabledGuard` gates the module, and `RedisRateLimitGuard`
 * reads the `@RateLimit` of the writes. This file parses the input and
 * delegates to `DesktopBuildsService`.
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
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
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
// Security check: a build spends credits and ships the app code, and the
// overview shows download links of unreleased builds. So every route needs
// an editor, as the mobile builds do. A caller without access gets 404 from the guard.
@RequireProjectRole("editor")
export class DesktopBuildsController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(DesktopBuildsService)
		private readonly desktop: Pick<
			DesktopBuildsService,
			"cancel" | "create" | "overview" | "release"
		>,
	) {}

	@Get()
	overview(
		@projectIdParam projectId: string,
		@Query(new ZodValidationPipe(desktopOverviewQuerySchema))
		query: DesktopOverviewQuery,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<DesktopOverviewResponse> {
		return this.desktop.overview(
			projectScopeFromAccess(access, user.id),
			projectId,
			query,
		);
	}

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
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<DesktopBuild> {
		return this.desktop.create(
			projectScopeFromAccess(access, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}

	// Idempotent: a build that already ended, or that signs, answers as it is, so 200 and not 201.
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
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<DesktopBuild> {
		return this.desktop.cancel(
			projectScopeFromAccess(access, user.id),
			projectId,
			buildId,
			readClientIp(request),
		);
	}

	// A release changes what every installed app downloads next. A repeat of
	// the same release is safe: 200.
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
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: Pick<FastifyRequest, "headers" | "ip">,
	): Promise<DesktopBuild> {
		return this.desktop.release(
			projectScopeFromAccess(access, user.id),
			projectId,
			buildId,
			readClientIp(request),
		);
	}
}
