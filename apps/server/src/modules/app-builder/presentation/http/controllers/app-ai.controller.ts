/**
 * `/api/v2/projects/:projectId/ai`: the AI panel routes of a V2 app. The
 * panel shows the gateway state and the month usage, and turns the key on,
 * rotates it, or turns it off. The global AuthGuard requires a session.
 * The global ProjectAccessGuard checks the project role. `V2BuilderEnabledGuard`
 * gates the module, and `RedisRateLimitGuard` reads `@RateLimit`.
 * `AppAiKeysService` holds the logic. No route answers the key.
 */
import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Post,
	Put,
	Req,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type AppAiStatus, uuidSchema } from "@wandit/contracts";
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
import { AppAiKeysService } from "../../../application/services/app-ai-keys.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { RetryAfterInterceptor } from "./cloud.controller";

const projectIdParam = Param("projectId", new ZodValidationPipe(uuidSchema));

// Each key write calls the Supabase Management API, and a rotate breaks the
// live key: 10 writes per user per 10 minutes, shared by the three routes.
const keyWriteRateLimit = RateLimit({
	key: "app-ai-key",
	limit: 10,
	windowMs: 10 * 60_000,
});

/** The AI panel routes of the V2 app builder. */
@Controller("v2/projects/:projectId/ai")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
@UseInterceptors(RetryAfterInterceptor)
// The AI key is a project secret, so the Secrets panel rule applies: an editor or higher, never a viewer.
@RequireProjectRole("editor")
export class AppAiController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(AppAiKeysService)
		private readonly appAi: Pick<
			AppAiKeysService,
			"status" | "writeKey" | "disable"
		>,
	) {}

	@Get()
	status(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<AppAiStatus> {
		return this.appAi.status(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// Keeps a live key: a second enable never breaks the running app.
	@keyWriteRateLimit
	@Put("key")
	enable(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<AppAiStatus> {
		return this.appAi.writeKey(
			"enable",
			projectScopeFromAccess(access, user.id),
			projectId,
			readClientIp(request),
		);
	}

	// A rotate creates no resource, so it answers 200, not the POST default 201.
	@keyWriteRateLimit
	@Post("key/rotate")
	@HttpCode(HttpStatus.OK)
	rotate(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<AppAiStatus> {
		return this.appAi.writeKey(
			"rotate",
			projectScopeFromAccess(access, user.id),
			projectId,
			readClientIp(request),
		);
	}

	@keyWriteRateLimit
	@Delete("key")
	@HttpCode(HttpStatus.NO_CONTENT)
	disable(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<void> {
		return this.appAi.disable(
			projectScopeFromAccess(access, user.id),
			projectId,
			readClientIp(request),
		);
	}
}
