/**
 * extend_video — queues one durable continuation of a succeeded project
 * video, backed by one to three independently resumable provider legs.
 *
 * Public reachability is not authorization: the source attempt is resolved
 * through a project-scoped succeeded lookup, then its URL, media type, and
 * lineage are snapshotted with the immutable leg plan before handoff.
 */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type ExtendVideoInput,
	type ExtendVideoOutput,
	extendVideoInputSchema,
	extendVideoOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
// Type-only import: importing the task value would pull the Trigger worker
// (and its database pool) into the Nest API process.
import type { extendVideoTask } from "../../../../trigger/extend-video.task";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	createVideoBilling,
	type VideoBilling,
} from "../../../media-generations/application/services/video-billing";
import { buildContinuationPrompt } from "../../../media-generations/domain/video-edit-extension-prompts";
import { resolveVideoGenerationPlan } from "../../../media-generations/domain/video-quality-models";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { assertFixedOperationProviderExecutionAllowed } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";

const logger = new Logger("extend-video");
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type ExtendVideoToolDeps = {
	chatId: string;
	mediaGenerationsRepository: MediaGenerationsRepository;
	meteringService: MeteringService;
	parentEventId?: string;
	projectId: string;
	requestKeySeed?: string;
	/** Pays for every requested continuation leg: the org pool in an org workspace. */
	subject: MeteringSubject;
	userId: string;
};

export function createExtendVideoTool(
	deps: ExtendVideoToolDeps,
): Tool<ExtendVideoInput, ExtendVideoOutput> {
	const billing = createVideoBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: deps.meteringService,
	});
	// Per-request clip ordinal: the tool instance is built per chat request, so
	// a transport-retried turn replays the same ordinals (0, 1, …) and dedupes
	// onto the existing attempts, while two extensions in one turn stay distinct.
	let clipOrdinal = 0;

	return tool({
		description:
			"Continue one finished, non-talking MP4 video made in this project " +
			"from its final frame. Call ONCE after choosing one to three 5- or " +
			"10-second additions and gathering the continuation brief. A clip can " +
			"have at most three additions across its lifetime. Fast motion can " +
			"stutter at joins; talking clips cannot be extended because lip-sync " +
			"would break. An optional continuous voiceover can cover the completed " +
			"longer video.",
		inputSchema: extendVideoInputSchema,
		outputSchema: extendVideoOutputSchema,
		execute: async (input, options): Promise<ExtendVideoOutput> => {
			const clip = clipOrdinal++;

			if (
				!env.AI_GATEWAY_API_KEY ||
				!env.R2_PUBLIC_BASE_URL ||
				!isR2Configured() ||
				!env.TRIGGER_SECRET_KEY
			) {
				return {
					message:
						"Video extension is not configured on this server yet. Tell the " +
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
					"Resolving the video extension source failed",
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
						"This clip's format cannot be extended yet. Only MP4 source clips " +
						"are supported in this version; tell the user plainly and do not " +
						"claim that it was queued.",
					status: "unavailable",
				};
			}

			if (source.talking === true) {
				return {
					message:
						"A clip with a person speaking on screen cannot be extended because " +
						"lip-sync would break across the joined pieces. Tell the user " +
						"plainly and offer to make a fresh longer clip instead.",
					status: "unavailable",
				};
			}

			if (
				source.voiceover !== null &&
				input.voiceover == null &&
				!input.acceptSilent
			) {
				return {
					message:
						"This source clip has existing narration, but extending it without a " +
						"new voiceover would remove that narration and make the longer video " +
						"silent. Do not queue it yet. Either collect one narration script for " +
						"the FULL new length, or get the user's plain confirmation that a " +
						"silent result is fine and call again with acceptSilent: true.",
					status: "unavailable",
				};
			}

			const remainingLegs = Math.max(0, 3 - source.chainDepth);

			if (input.legCount > remainingLegs) {
				const roomDescription = `${remainingLegs} more ${
					remainingLegs === 1 ? "addition" : "additions"
				}`;

				return {
					message:
						`This clip has room for ${roomDescription}, but ${input.legCount} ` +
						`${input.legCount === 1 ? "addition was" : "additions were"} requested. ` +
						"A clip can have at most 3 additions over its lifetime; tell the " +
						"user plainly and ask for an amount that fits.",
					status: "unavailable",
				};
			}

			const plan = resolveVideoGenerationPlan({
				durationSeconds: input.legDurationSeconds,
				kind: "i2v",
				multiShot: false,
				narration: false,
				quality: "standard",
				talking: false,
			});
			const prompt = buildContinuationPrompt(input.continuationBrief);
			const targetDurationSeconds = Math.min(
				45,
				Math.round(source.durationSeconds) +
					input.legCount * input.legDurationSeconds,
			);

			let attempt: {
				created: boolean;
				id: string;
				status: "queued" | "generating" | "succeeded" | "failed";
			};

			try {
				// Only transport-stable fields enter the hash. The continuation brief,
				// title, and voiceover script can be recomposed on a replay; the first
				// persisted snapshot decides what renders. The ordinal separates two
				// extensions made in the same turn.
				const requestKey = createHash("sha256")
					.update(
						JSON.stringify({
							clip,
							request: deps.requestKeySeed ?? options.toolCallId,
							sourceAttemptId: input.sourceAttemptId,
							legCount: input.legCount,
							legDurationSeconds: input.legDurationSeconds,
						}),
					)
					.digest("hex");

				attempt = await deps.mediaGenerationsRepository.insertExtensionAttempt(
					{
						aspect: source.aspect,
						chainDepth: source.chainDepth + input.legCount,
						chatId: deps.chatId,
						durationSeconds: targetDurationSeconds,
						kind: "video-extension",
						model: plan.modelId,
						motion: null,
						projectId: deps.projectId,
						prompt,
						quality: plan.quality,
						requestKey,
						sourceAttemptId: source.id,
						sourceImageUrl: null,
						sourceMediaType: null,
						sourceVideoMediaType: source.videoMediaType,
						sourceVideoUrl: source.videoUrl,
						talking: false,
						title: input.title,
						voiceover: input.voiceover ?? null,
					},
					Array.from({ length: input.legCount }, (_, index) => ({
						durationSeconds: input.legDurationSeconds,
						model: plan.modelId,
						seq: index + 1,
					})),
				);
			} catch (error) {
				logger.error(
					"Creating the video extension attempt failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The video extension could not be saved on the server. Tell the " +
						"user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "failed") {
				await refundReservation(deps, billing, attempt.id);

				return {
					message:
						"This exact video extension already failed. Tell the user and wait " +
						"for a new request before retrying.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "queued") {
				return {
					attemptId: attempt.id,
					message:
						"This video extension was already accepted. Its existing progress " +
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
						"This video extension was already accepted. Its existing progress " +
						"or result card appears in the conversation.",
					status: "queued",
				};
			}

			const reservation = await billing.reserve(
				deps.subject,
				attempt.id,
				input.legCount,
				deps.parentEventId,
				undefined,
				// Per leg: every continuation renders one legDurationSeconds clip.
				{
					durationSeconds: input.legDurationSeconds,
					kind: "video-extension",
					modelId: plan.modelId,
				},
			);

			assertFixedOperationProviderExecutionAllowed(reservation);

			let handle: Awaited<ReturnType<typeof tasks.trigger>>;

			try {
				handle = await triggerExtendVideoTask({
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
					`Trigger.dev did not confirm video extension ${attempt.id}: ${message}`,
				);

				if (isDefinitiveTriggerRejection(error)) {
					try {
						const closed =
							await deps.mediaGenerationsRepository.markAttemptFailed(
								attempt.id,
								"The background extension worker rejected this request. Please try again.",
								deps.userId,
							);

						if (closed) {
							await refundReservation(deps, billing, attempt.id);

							return {
								message:
									"Trigger.dev rejected the video extension. Tell the user it " +
									"was not queued and offer to retry after the server " +
									"configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (settlementError) {
						logger.error(
							`Closing rejected video extension ${attempt.id} failed`,
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
						"The video extension is saved, but Trigger.dev did not confirm the " +
						"handoff yet. Its card will keep checking, and the same request can " +
						"be retried safely.",
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
			const legLabel = input.legCount === 1 ? "piece" : "pieces";
			const voiceoverReceipt = input.voiceover?.script
				? " A continuous narration track will be laid over the longer video."
				: input.voiceover
					? " The voiceover language is saved, but without an exact script the longer video will be silent."
					: "";

			return {
				attemptId: attempt.id,
				...(realtime ? { realtime } : {}),
				message:
					`Queued: adding ${input.legCount} ${input.legDurationSeconds}-second ` +
					`${legLabel} from the source clip's final frame, targeting about ` +
					`${targetDurationSeconds} seconds total. Progress and the playable ` +
					`result appear here in the conversation.${voiceoverReceipt}`,
				status: "queued",
			};
		},
	});
}

/**
 * Best-effort Realtime handle: failure degrades the card to polling and must
 * never fail a successfully queued extension.
 */
async function mintRealtimeHandle(
	runId: string,
): Promise<ExtendVideoOutput["realtime"]> {
	try {
		const publicAccessToken = await auth.createPublicToken({
			expirationTime: "2h",
			scopes: { read: { runs: [runId] } },
		});

		return { publicAccessToken, runId };
	} catch (error) {
		logger.warn(
			`Realtime token minting failed for run ${runId} — the extension card will rely on polling: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);

		return undefined;
	}
}

async function triggerExtendVideoTask(payload: {
	attemptId: string;
	billingMode: "enforce" | "off";
	organizationId: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`video-extend:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof extendVideoTask>(
				"extend-video",
				payload,
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`media-attempt:${payload.attemptId}`,
						`project:${payload.projectId}`,
					],
					// The DB's queued-attempt reconciler closes requests whose Trigger
					// queue never starts them after this shorter handoff window.
					ttl: "25m",
				},
			);
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
	deps: ExtendVideoToolDeps,
	billing: VideoBilling,
	attemptId: string,
): Promise<void> {
	try {
		await billing.refund(deps.subject, attemptId, "video-extension");
	} catch (error) {
		logger.error(
			`Refunding video extension reservation ${attemptId} failed`,
			error instanceof Error ? error.stack : String(error),
		);
	}
}

export type ExtendVideoTool = ReturnType<typeof createExtendVideoTool>;

export const extendVideoToolSchemaOnly: Tool<
	ExtendVideoInput,
	ExtendVideoOutput
> = tool({
	inputSchema: extendVideoInputSchema,
	outputSchema: extendVideoOutputSchema,
});
