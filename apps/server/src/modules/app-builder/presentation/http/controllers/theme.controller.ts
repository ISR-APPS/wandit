/**
 * `/api/v2/projects/:projectId/theme`: the theme read and the theme save of the builder Thème sheet.
 * Both routes sit behind the global AuthGuard, the global ProjectAccessGuard, and the
 * `V2BuilderEnabledGuard`. `RedisRateLimitGuard` reads the `@RateLimit` of the save. Scope, lock, and commit live in `AppThemeService`.
 */
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Put,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { uuidSchema } from "@wandit/contracts";
import {
	type GetAppThemeResponse,
	type PutAppThemeBody,
	type PutAppThemeResponse,
	putAppThemeBodySchema,
} from "@wandit/contracts/v2/app-theme";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { AppThemeService } from "../../../application/services/app-theme.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/** The two theme routes of the V2 app builder. */
@Controller("v2/projects/:projectId/theme")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class ThemeController {
	constructor(
		@Inject(AppThemeService)
		private readonly themes: Pick<AppThemeService, "get" | "save">,
	) {}

	// A read, so a project viewer may call it, like the Code view routes.
	@RequireProjectRole("viewer")
	@Get()
	get(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<GetAppThemeResponse> {
		return this.themes.get(projectScopeFromAccess(access, user.id), projectId);
	}

	// A save writes a commit, so it needs the role of a turn. Each save runs git and a push in the
	// sandbox: 10 saves per user per minute leave room for a user who clicks Save again and again.
	@RequireProjectRole("editor")
	@RateLimit({ key: "theme-save", limit: 10, windowMs: 60_000 })
	@Put()
	save(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(putAppThemeBodySchema))
		body: PutAppThemeBody,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<PutAppThemeResponse> {
		return this.themes.save(
			projectScopeFromAccess(access, user.id),
			projectId,
			body,
		);
	}
}
