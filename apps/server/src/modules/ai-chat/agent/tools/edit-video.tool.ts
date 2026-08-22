/**
 * edit_video — queues one durable edit of a succeeded project video.
 *
 * Public reachability is not authorization: the source attempt is resolved
 * through a project-scoped succeeded lookup, then its URL, media type, and
 * lineage are snapshotted before the Trigger handoff.
 */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type EditVideoInput,
	type EditVideoOutput,
	editVideoInputSchema,
	editVideoOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
// Type-only import: importing the task value would pull the Trigger worker
// (and its database pool) into the Nest API process.
import type { editVideoTask } from "../../../../trigger/edit-video.task";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	createVideoBilling,
	type VideoBilling,
} from "../../../media-generations/application/services/video-billing";
import { buildEditPrompt } from "../../../media-generations/domain/video-edit-extension-prompts";
import { VIDEO_EDIT_ENGINE_MODEL } from "../../../media-generations/domain/video-quality-models";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { assertFixedOperationProviderExecutionAllowed } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";

const logger = new Logger("edit-video");
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type EditVideoToolDeps = {
	chatId: string;
	mediaGenerationsRepository: MediaGenerationsRepository;
	meteringService: MeteringService;
	parentEventId?: string;
	projectId: string;
	requestKeySeed?: string;
	/** Pays for the edit: the org pool in an org workspace. */
	subject: MeteringSubject;
	userId: string;
};

export function createEditVideoTool(
	deps: EditVideoToolDeps,
): Tool<EditVideoInput, EditVideoOutput> {
	const billing = createVideoBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: deps.meteringService,
	});
	// Per-request clip ordinal: the tool instance is built per chat request, so
	// a transport-retried turn replays the same ordinals (0, 1, …) and dedupes
	// onto the existing attempts, while two edits in one turn stay distinct.
	let clipOrdinal = 0;

	return tool({
		description:
			"Edit one finished MP4 video made in this project while preserving its " +
			"length and framing. Call ONCE after gathering what should change and " +
			"what must stay the same. The whole clip is re-rendered, so tiny details " +
			"can shift; warn before editing a talking clip because lip-sync may not " +
			"survive. The result appears as a new video in the conversation.",
		inputSchema: editVideoInputSchema,
		outputSchema: editVideoOutputSchema,
		execute: async (input, options): Promise<EditVideoOutput> => {
			const clip = clipOrdinal++;

			if (
				!env.AI_GATEWAY_API_KEY ||
				!env.R2_PUBLIC_BASE_URL ||
				!isR2Configured() ||
				!env.TRIGGER_SECRET_KEY
			) {
				return {
					message:
						"Video editing is not configured on this server yet. Tell the " +
						"user honestly that AI gateway, storage, and Trigger.dev " +
						"credentials are required.",
					status: "unavailable",
				};
			}

			let source: Awaited<
				ReturnType<MediaGenerationsRepository["findSucceededForProject"]>
			>;

			try {
				source = await deps.mediaGenerationsRepository.findSucceededForProject(
					deps.projectId,
					input.sourceAttemptId,
				);
			} catch (error) {
				logger.error(
					"Resolving the video edit source failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The source video could not be checked on the server. Tell the " +
						"user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!source?.videoUrl) {
				return {
					message:
						"That source is not a finished video made in this project. Tell " +
						"the user plainly and ask them to choose a completed clip from " +
						"this project.",
					status: "unavailable",
				};
			}

			if (source.videoMediaType !== "video/mp4") {
				return {
					message:
						"This clip's format cannot be edited yet. Only MP4 source clips " +
						"are supported in this version; tell the user plainly and do " +
						"not claim that it was queued.",
					status: "unavailable",
				};
			}

			if (
				!Number.isSafeInteger(source.durationSeconds) ||
				source.durationSeconds < 4 ||
				source.durationSeconds > 30
			) {
				return {
					message:
						`This source clip is ${source.durationSeconds} seconds long. ` +
						"Video editing currently accepts clips from 4 through 30 seconds; " +
						"tell the user plainly and ask them to choose a clip in that range.",
					status: "unavailable",
				};
			}

			let attempt: {
				created: boolean;
				id: string;
				status: "queued" | "generating" | "succeeded" | "failed";
			};

			try {
				// Only transport-stable fields enter the hash. Instruction and title
				// can be recomposed by the model on a replay; the first persisted
				// snapshot decides what renders. The ordinal separates two edits made
				// in the same turn.
				const requestKey = createHash("sha256")
					.update(
						JSON.stringify({
							clip,
							request: deps.requestKeySeed ?? options.toolCallId,
							sourceAttemptId: input.sourceAttemptId,
						}),
					)
					.digest("hex");

				attempt = await deps.mediaGenerationsRepository.insertAttempt({
					aspect: source.aspect,
					chainDepth: source.chainDepth,
					chatId: deps.chatId,
					durationSeconds: source.durationSeconds,
					kind: "video-edit",
					model: VIDEO_EDIT_ENGINE_MODEL,
					motion: null,
					projectId: deps.projectId,
					prompt: buildEditPrompt(input.instruction),
					quality: null,
					requestKey,
					sourceAttemptId: source.id,
					sourceImageUrl: null,
					sourceMediaType: null,
					sourceVideoMediaType: source.videoMediaType,
					sourceVideoUrl: source.videoUrl,
					talking: null,
					title: input.title,
					voiceover: null,
				});
			} catch (error) {
				logger.error(
					"Creating the video edit attempt failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The video edit could not be saved on the server. Tell the user " +
						"and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "failed") {
				await refundReservation(deps, billing, attempt.id);

				return {
					message:
						"This exact video edit already failed. Tell the user and wait for " +
						"a new request before retrying.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "queued") {
				return {
					attemptId: attempt.id,
					message:
						"This video edit was already accepted. Its existing progress " +
						"card appears in the conversation.",
					status: "queued",
				};
			}

			if (
				!attempt.created &&
				(attempt.status === "generating" || attempt.status === "succeeded")
			) {
				return {
					attemptId: attempt.id,
					message:
						"This video edit was already accepted. Its existing progress or " +
						"result card appears in the conversation.",
					status: "queued",
				};
			}

			const reservation = await billing.reserve(
				deps.subject,
				attempt.id,
				1,
				deps.parentEventId,
				undefined,
				{
					durationSeconds: source.durationSeconds,
					kind: "video-edit",
					modelId: VIDEO_EDIT_ENGINE_MODEL,
				},
			);

			assertFixedOperationProviderExecutionAllowed(reservation);

			let handle: Awaited<ReturnType<typeof tasks.trigger>>;

			try {
				handle = await triggerEditVideoTask({
					attemptId: attempt.id,
					billingMode: reservation.eventId ? "enforce" : "off",
					organizationId: deps.subject.organizationId ?? null,
					...(deps.parentEventId ? { parentEventId: deps.parentEventId } : {}),
					projectId: deps.projectId,
					userId: deps.userId,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				logger.error(
					`Trigger.dev did not confirm video edit ${attempt.id}: ${message}`,
				);

				if (isDefinitiveTriggerRejection(error)) {
					try {
						const closed =
							await deps.mediaGenerationsRepository.markAttemptFailed(
								attempt.id,
								"The background editor rejected this request. Please try again.",
								deps.userId,
							);

						if (closed) {
							await refundReservation(deps, billing, attempt.id);

							return {
								message:
									"Trigger.dev rejected the video edit. Tell the user it was " +
									"not queued and offer to retry after the server " +
									"configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (settlementError) {
						logger.error(
							`Closing rejected video edit ${attempt.id} failed`,
							settlementError instanceof Error
								? settlementError.stack
								: String(settlementError),
						);
					}
				}

				// Trigger may accept a request even when the HTTP response is lost.
				// The attempt key makes retry safe, so leave an ambiguous handoff
				// queued for the stale-attempt reconciler.
				return {
					attemptId: attempt.id,
					message:
						"The video edit is saved, but Trigger.dev did not confirm the " +
						"handoff yet. Its card will keep checking, and the same request " +
						"can be retried safely.",
					status: "queued",
				};
			}

			// The task can claim the row immediately after tasks.trigger resolves.
			// Persisting the diagnostic run id is best-effort; the task writes the
			// same id as part of its atomic queued -> generating claim.
			try {
				await deps.mediaGenerationsRepository.markAttemptTriggered(
					attempt.id,
					handle.id,
				);
			} catch (error) {
				logger.warn(
					`Could not persist Trigger.dev run id for ${attempt.id}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}

			const realtime = await mintRealtimeHandle(handle.id);

			return {
				attemptId: attempt.id,
				...(realtime ? { realtime } : {}),
				message:
					`Queued: the ${source.durationSeconds}-second source clip is being ` +
					"re-rendered with the requested edit. It will keep the same length " +
					"and framing; progress and the playable result appear here in the " +
					"conversation.",
				status: "queued",
			};
		},
	});
}

/**
 * Best-effort Realtime handle: failure degrades the card to polling and must
 * never fail a successfully queued edit.
 */
async function mintRealtimeHandle(
	runId: string,
): Promise<EditVideoOutput["realtime"]> {
	try {
		const publicAccessToken = await auth.createPublicToken({
			expirationTime: "2h",
			scopes: { read: { runs: [runId] } },
		});

		return { publicAccessToken, runId };
	} catch (error) {
		logger.warn(
			`Realtime token minting failed for run ${runId} — the edit card will rely on polling: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);

		return undefined;
	}
}

async function triggerEditVideoTask(payload: {
	attemptId: string;
	billingMode: "enforce" | "off";
	organizationId: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`video-edit:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof editVideoTask>("edit-video", payload, {
				idempotencyKey,
				idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
				tags: [
					`media-attempt:${payload.attemptId}`,
					`project:${payload.projectId}`,
				],
				// The DB's queued-attempt reconciler closes requests whose Trigger
				// queue never starts them after this shorter handoff window.
				ttl: "25m",
			});
		} catch (error) {
			lastError = error;

			if (isDefinitiveTriggerRejection(error)) {
				break;
			}

			if (attempt < TRIGGER_HANDOFF_ATTEMPTS - 1) {
				await delay(100 * 2 ** attempt);
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Trigger.dev handoff failed");
}

function isDefinitiveTriggerRejection(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const candidate = error as { name?: unknown; status?: unknown };

	return (
		candidate.name === "TriggerApiError" &&
		(candidate.status === 400 ||
			candidate.status === 401 ||
			candidate.status === 403 ||
			candidate.status === 404 ||
			candidate.status === 422)
	);
}

async function refundReservation(
	deps: EditVideoToolDeps,
	billing: VideoBilling,
	attemptId: string,
): Promise<void> {
	try {
		await billing.refund(deps.subject, attemptId, "video-edit");
	} catch (error) {
		logger.error(
			`Refunding video edit reservation ${attemptId} failed`,
			error instanceof Error ? error.stack : String(error),
		);
	}
}

export type EditVideoTool = ReturnType<typeof createEditVideoTool>;

export const editVideoToolSchemaOnly: Tool<EditVideoInput, EditVideoOutput> =
	tool({
		inputSchema: editVideoInputSchema,
		outputSchema: editVideoOutputSchema,
	});
