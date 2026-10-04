/**
 * HTTP routes for V2 builder turns: create, estimate, stream, cancel.
 * `V2BuilderEnabledGuard` gates the whole controller; `RedisRateLimitGuard`
 * reads the per-route `@RateLimit` metadata. Scope and engine checks live
 * in `TurnsService`; this file only parses and delegates.
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
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { TurnStreamRelayService } from "../../../application/services/turn-stream-relay.service";
import {
	TurnsService,
	turnCreatedResponseOf,
} from "../../../application/services/turns.service";
import {
	RateLimit,
	RedisRateLimitGuard,
	TURN_STREAM_BUCKET,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

// 30 creates or cancels per user per 10 min — a human cannot click faster.
const TURN_MUTATION_LIMIT = 30;
const TURN_MUTATION_WINDOW_MS = 600_000;
// 90 turn creates per IP per 10 min (WANDIT-181): three times the user cap.
// Three people behind one office IP still fit, but the cap stops one person
// who uses many accounts.
const TURN_CREATE_IP_LIMIT = 90;

// An open SSE slot stays taken until the stream closes or this TTL lapses.
// A turn cannot outlive ~2 lock TTLs, so 60 min covers any real stream.
const STREAM_SLOT_LIMIT = 5;
const STREAM_SLOT_TTL_MS = 60 * 60_000;

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
	// promotion gives it a run.
	@RequireWorkspacePermission("project", "update")
	@RateLimit({
		ipLimit: TURN_CREATE_IP_LIMIT,
		key: "turn-create",
		limit: TURN_MUTATION_LIMIT,
		windowMs: TURN_MUTATION_WINDOW_MS,
	})
	@Post()
	@SkipResponseEnvelope()
	async create(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(createTurnRequestSchema))
		body: CreateTurnRequest,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		// Every error before this line keeps the normal JSON error envelope
		// (404, 409, 402, 403); the reply is hijacked only below.
		const created = await this.turns.create(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
			{
				ip: readClientIp(request),
				// `elapsedTime` counts from the request arrival, so the guards count too.
				requestStartedAt: Date.now() - reply.elapsedTime,
			},
		);
		await this.relay.relay({
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

	// A read like the stream routes: the service checks the scope, so no
	// permission decorator. Declared before `:turnId/stream`.
	@Get("estimate")
	estimate(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<TurnEstimateResponse> {
		return this.turns.estimate(projectScopeFrom(workspace, user.id), projectId);
	}

	// Declared before `:turnId/stream` so "active" is not read as a turn id.
	@Get("active/stream")
	@RateLimit({
		key: TURN_STREAM_BUCKET,
		limit: STREAM_SLOT_LIMIT,
		mode: "open",
		windowMs: STREAM_SLOT_TTL_MS,
	})
	@SkipResponseEnvelope()
	async activeStream(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const scope = projectScopeFrom(workspace, user.id);
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
	@Get(":turnId/stream")
	@RateLimit({
		key: TURN_STREAM_BUCKET,
		limit: STREAM_SLOT_LIMIT,
		mode: "open",
		windowMs: STREAM_SLOT_TTL_MS,
	})
	@SkipResponseEnvelope()
	async stream(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("turnId", new ZodValidationPipe(uuidSchema))
		turnId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		try {
			const turn = await this.turns.assertStreamAccess(
				projectScopeFrom(workspace, user.id),
				projectId,
				turnId,
			);

			if (turn.runner === "trigger" && !turn.triggerRunId) {
				// A queued or waiting Trigger turn has no stream yet; the client
				// retries. A host turn streams from Redis by its turn id.
				await reply.code(204).send();
				await this.relay.releaseStreamSlot(request);
				return;
			}

			await this.relay.relay({
				onDone: () => this.turns.handleTurnEnded(turn.projectId, turn.id),
				reply,
				request,
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
	@RequireWorkspacePermission("project", "update")
	@RateLimit({
		key: "turn-cancel",
		limit: TURN_MUTATION_LIMIT,
		windowMs: TURN_MUTATION_WINDOW_MS,
	})
	@Post(":turnId/cancel")
	@HttpCode(200)
	cancel(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("turnId", new ZodValidationPipe(uuidSchema))
		turnId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<CancelTurnResponse> {
		return this.turns.cancel(
			projectScopeFrom(workspace, user.id),
			projectId,
			turnId,
			readClientIp(request),
		);
	}
}
