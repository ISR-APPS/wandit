/**
 * `GET /api/v2/projects/:projectId/preview-token`: the signed 15-minute
 * preview URL of the project's running sandbox (WANDIT-170). With
 * `?client=phone` the token feeds the phone link of the Worker (WANDIT-193).
 * The global AuthGuard requires a session; `V2BuilderEnabledGuard` gates
 * the route and `RedisRateLimitGuard` reads the `@RateLimit` metadata.
 * The global ProjectAccessGuard checks the project role.
 * Scope and sandbox checks live in `PreviewTokenService`.
 */
import {
	Controller,
	Get,
	Inject,
	Param,
	Query,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type PreviewTokenQuery,
	type PreviewTokenResponse,
	previewTokenQuerySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { PreviewTokenService } from "../../../application/services/preview-token.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/** The preview-token route of the V2 app builder. */
@Controller("v2/projects/:projectId/preview-token")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class PreviewTokenController {
	constructor(
		@Inject(PreviewTokenService)
		private readonly previewTokens: PreviewTokenService,
	) {}

	// Minting is a read like `versions.list`, so a project viewer may call it.
	// 30 per user per minute: one refresh every 30 s per open builder tab
	// stays far below it.
	@RequireProjectRole("viewer")
	@RateLimit({ key: "preview-token", limit: 30, windowMs: 60_000 })
	@Get()
	mint(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Query(new ZodValidationPipe(previewTokenQuerySchema))
		query: PreviewTokenQuery,
	): Promise<PreviewTokenResponse> {
		return this.previewTokens.mint(
			projectScopeFromAccess(access, user.id),
			projectId,
			query,
		);
	}
}
