/**
 * `POST /api/v2/projects/:projectId/device-sessions` and
 * `POST .../device-sessions/:deviceSessionId/end`: the Appetize device
 * preview of a V2 mobile project (WANDIT-196). The global AuthGuard requires
 * a session; the global ProjectAccessGuard checks the project role;
 * `V2BuilderEnabledGuard` gates the routes and `RedisRateLimitGuard` reads `@RateLimit`. `DeviceSessionsService` holds
 * the project, minute, and lock checks.
 */
import {
	Body,
	Controller,
	HttpCode,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type EndDeviceSessionRequest,
	endDeviceSessionRequestSchema,
	type StartDeviceSessionRequest,
	type StartDeviceSessionResponse,
	startDeviceSessionRequestSchema,
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
import { DeviceSessionsService } from "../../../application/services/device-sessions.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/** The device-session routes of the V2 app builder. */
@Controller("v2/projects/:projectId/device-sessions")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class DeviceSessionsController {
	constructor(
		// A spec passes a plain fake; Nest still injects by the class token.
		@Inject(DeviceSessionsService)
		private readonly deviceSessions: Pick<
			DeviceSessionsService,
			"start" | "end"
		>,
	) {}

	// Device minutes cost money, so a start needs the role of a turn.
	// 10 starts per user per minute: one start takes seconds; a retry loop stops here.
	@RequireProjectRole("editor")
	@RateLimit({ key: "device-session-start", limit: 10, windowMs: 60_000 })
	@Post()
	start(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(startDeviceSessionRequestSchema))
		body: StartDeviceSessionRequest,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<StartDeviceSessionResponse> {
		return this.deviceSessions.start(
			projectScopeFromAccess(access, user.id),
			projectId,
			body.platform,
		);
	}

	// Design 2.2 puts device sessions under editor. The minutes task bills a session that a downgraded caller cannot end.
	@RequireProjectRole("editor")
	@RateLimit({ key: "device-session-end", limit: 30, windowMs: 60_000 })
	@Post(":deviceSessionId/end")
	@HttpCode(200)
	end(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("deviceSessionId", new ZodValidationPipe(uuidSchema))
		deviceSessionId: string,
		@Body(new ZodValidationPipe(endDeviceSessionRequestSchema))
		body: EndDeviceSessionRequest,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<{ ended: true }> {
		return this.deviceSessions.end(
			projectScopeFromAccess(access, user.id),
			projectId,
			deviceSessionId,
			body.appetizeSessionToken,
		);
	}
}
