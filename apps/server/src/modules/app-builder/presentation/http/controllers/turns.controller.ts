/**
 * HTTP routes for V2 builder turns: create, estimate, the poll of the
 * builder page, stream, cancel.
 * `V2BuilderEnabledGuard` gates the whole controller; `RedisRateLimitGuard`
 * reads the per-route `@RateLimit` metadata. The global ProjectAccessGuard
 * checks the project role. Scope and engine checks live in `TurnsService`;
 * this file only parses and delegates.
 */
import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type ActiveTurnStateResponse,
	type CancelTurnResponse,
	type CreateTurnRequest,
	createTurnRequestSchema,
	type TurnEstimateResponse,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";

import { readClientIp } from "../../../../../infrastructure/http/client-ip";
import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { TurnStreamRelayService } from "../../../application/services/turn-stream-relay.service";
import {
	TurnsService,
	turnCreatedResponseOf,
} from "../../../application/services/turns.service";
import {
	RateLimit,
	RedisRateLimitGuard,
	TURN_CANCEL_RATE_LIMIT,
	TURN_CREATE_RATE_LIMIT,
	TURN_STREAM_RATE_LIMIT,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/**
 * True for a member of the project's workspace and for the project owner. Only they
 * read the payer pool (workspaces-sharing.md 4, Views). A direct grant alone does not.
 */
function canReadPayerBalance(access: ResolvedProjectAccess): boolean {
	return access.workspaceRoles.length > 0 || access.role === "owner";
}

@Controller("v2/projects/:projectId/turns")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class TurnsController {
	constructor(
		@Inject(TurnsService)
		private readonly turns: TurnsService,
		@Inject(TurnStreamRelayService)
		private readonly relay: TurnStreamRelayService,
	) {}

	// The POST answers with the browser stream of the new turn, as
	// `DefaultChatTransport` expects; a `waiting` turn streams as soon as
	// promotion gives it a run. A prompt spends credits, so it needs an editor.
	@RequireProjectRole("editor")
	@RateLimit(TURN_CREATE_RATE_LIMIT)
	@Post()
	@SkipResponseEnvelope()
	async create(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(createTurnRequestSchema))
		body: CreateTurnRequest,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		// Every error before this line keeps the normal JSON error envelope
		// (404, 409, 402, 403); the reply is hijacked only below.
		const created = await this.turns.create(
			projectScopeFromAccess(access, user.id),
			projectId,
			body,
			{
				ip: readClientIp(request),
				// `elapsedTime` counts from the request arrival, so the guards count too.
				requestStartedAt: Date.now() - reply.elapsedTime,
			},
		);
		await this.relay.relay({
			canReadPayerBalance: canReadPayerBalance(access),
			first: created,
			onDone: () => this.turns.handleTurnEnded(projectId, created.turnId),
			// The turn-create guard takes a count slot, not an open-stream slot.
			releaseSlot: false,
			reply,
			request,
			triggerRunId: created.runId,
			turnId: created.turnId,
		});
	}

	// A read like the stream routes. Declared before `:turnId/stream`.
	@RequireProjectRole("viewer")
	@Get("estimate")
	estimate(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<TurnEstimateResponse> {
		return this.turns.estimate(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// A read like the stream routes. No `@RateLimit`: every open builder tab
	// polls it every 5 s, and the open-stream bucket counts only SSE slots.
	@RequireProjectRole("viewer")
	@Get("active")
	activeTurnState(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ActiveTurnStateResponse> {
		return this.turns.activeTurnState(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// Declared before `:turnId/stream` so "active" is not read as a turn id.
	@RequireProjectRole("viewer")
	@Get("active/stream")
	@RateLimit(TURN_STREAM_RATE_LIMIT)
	@SkipResponseEnvelope()
	async activeStream(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const scope = projectScopeFromAccess(access, user.id);
		try {
			const turn = await this.turns.findActiveTurn(scope, projectId);

			if (!turn) {
				// No active turn: nothing to resume, so the guard's open slot
				// goes back. `DefaultChatTransport` reads 204 as that answer.
				await reply.code(204).send();
				await this.relay.releaseStreamSlot(request);
				return;
			}

			await this.relay.relay({
				canReadPayerBalance: canReadPayerBalance(access),
				// The first frame gives the browser the turn id after a reload,
				// so Stop can post the cancel. A row whose chat was deleted has
				// no frame.
				...(turn.chatId === null
					? {}
					: { first: turnCreatedResponseOf(turn, turn.chatId, null) }),
				onDone: () => this.turns.handleTurnEnded(turn.projectId, turn.id),
				reply,
				request,
				// Null while the row waits for its run id; the relay polls it.
				triggerRunId: turn.triggerRunId,
				turnId: turn.id,
			});
		} catch (error) {
			// A failed open must free the counted slot, or five dead opens
			// wedge the bucket for the TTL. The relay releases in its own
			// finally, so a throw that reaches here still holds the slot.
			await this.relay.releaseStreamSlot(request);
			throw error;
		}
	}

	// Replays the whole `ui` stream from the start; no Last-Event-ID (D20).
	// The browser reopens it after a cut and drops the chunks it already has.
	@RequireProjectRole("viewer")
	@Get(":turnId/stream")
	@RateLimit(TURN_STREAM_RATE_LIMIT)
	@SkipResponseEnvelope()
	async stream(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("turnId", new ZodValidationPipe(uuidSchema))
		turnId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		try {
			const turn = await this.turns.assertStreamAccess(
				projectScopeFromAccess(access, user.id),
				projectId,
				turnId,
			);

			await this.relay.relay({
				canReadPayerBalance: canReadPayerBalance(access),
				onDone: () => this.turns.handleTurnEnded(turn.projectId, turn.id),
				reply,
				request,
				// Null while a waiting row has no run yet: the relay polls the
				// row, and a row canceled before its run ends the stream.
				triggerRunId: turn.triggerRunId,
				turnId: turn.id,
			});
		} catch (error) {
			// Same release rule as `activeStream`: a failed open must free the
			// counted slot. The relay's own finally only runs once it started.
			await this.relay.releaseStreamSlot(request);
			throw error;
		}
	}

	// Idempotent: a terminal turn answers its current status (V1 shape).
	@RequireProjectRole("editor")
	@RateLimit(TURN_CANCEL_RATE_LIMIT)
	@Post(":turnId/cancel")
	@HttpCode(200)
	cancel(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("turnId", new ZodValidationPipe(uuidSchema))
		turnId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Req() request: FastifyRequest,
	): Promise<CancelTurnResponse> {
		return this.turns.cancel(
			projectScopeFromAccess(access, user.id),
			projectId,
			turnId,
			readClientIp(request),
		);
	}
}
