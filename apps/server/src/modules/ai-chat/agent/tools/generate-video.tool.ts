/**
 * generate_video — queues one durable text-to-video job from a creative
 * brief.
 *
 * The Brain gathers the brief in conversation (ask_user for video type,
 * format, duration, voiceover); the server-side creative director rewrites
 * it into ONE domain-language provider prompt at queue time and snapshots it
 * on the attempt row, so the background task executes exactly what was
 * captured. Talking-person speech and off-camera narration both route through
 * Kling 3.0's native voice control; the persisted talking flag still means a
 * person visibly speaks on screen.
 */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type GenerateVideoInput,
	type GenerateVideoOutput,
	generateVideoInputSchema,
	generateVideoOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
// Type-only import: importing the task value would pull the Trigger worker
// (and its database pool) into the Nest API process.
import type { generateVideoTask } from "../../../../trigger/generate-video.task";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	createImageAnimationBilling,
	type ImageAnimationBilling,
} from "../../../media-generations/application/services/image-animation-billing";
import {
	appendNativeNarrationToVideoPrompt,
	type VideoDirectorService,
} from "../../../media-generations/application/services/video-director";
import { resolveVideoGenerationPlan } from "../../../media-generations/domain/video-quality-models";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { assertFixedOperationProviderExecutionAllowed } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";

const logger = new Logger("generate-video");
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type GenerateVideoToolDeps = {
	chatId: string;
	mediaGenerationsRepository: MediaGenerationsRepository;
	meteringService: MeteringService;
	parentEventId?: string;
	projectId: string;
	requestKeySeed?: string;
	/** Pays for the video: the org pool in an org workspace. */
	subject: MeteringSubject;
	userId: string;
	videoDirector: VideoDirectorService;
};

export function createGenerateVideoTool(
	deps: GenerateVideoToolDeps,
): Tool<GenerateVideoInput, GenerateVideoOutput> {
	const billing = createImageAnimationBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: deps.meteringService,
	});
	// Per-request clip ordinal: the tool instance is built per chat request, so
	// a transport-retried turn replays the same ordinals (0, 1, …) and dedupes
	// onto the existing attempts, while a genuine second clip in the same turn
	// still gets its own requestKey.
	let clipOrdinal = 0;

	return tool({
		description:
			"Queue one text-to-video generation from a complete creative brief. " +
			"Call it ONCE per requested clip, after the brief is complete — the " +
			"render runs in the background and a live progress card plus the " +
			"playable result appear in the conversation. Wandit's video director " +
			"rewrites the brief into a professional generation prompt " +
			"automatically, so pass the brief faithfully instead of prompt " +
			"engineering. Not for animating an uploaded image — that is " +
			"animate_image.",
		inputSchema: generateVideoInputSchema,
		outputSchema: generateVideoOutputSchema,
		execute: async (input, options): Promise<GenerateVideoOutput> => {
			const clip = clipOrdinal++;
			const narration = Boolean(input.voiceover?.script) && !input.talking;
			const plan = resolveVideoGenerationPlan({
				durationSeconds: input.durationSeconds,
				kind: "t2v",
				multiShot: input.multiShot,
				narration,
				quality: input.quality,
				talking: input.talking,
			});

			if (
				!env.AI_GATEWAY_API_KEY ||
				!env.R2_PUBLIC_BASE_URL ||
				!isR2Configured() ||
				!env.TRIGGER_SECRET_KEY
			) {
				return {
					message:
						"Video generation is not configured on this server yet. Tell " +
						"the user honestly that AI gateway, storage, and " +
						"Trigger.dev credentials are required.",
					status: "unavailable",
				};
			}

			// Crafted BEFORE the attempt insert (same order as the Higgsfield
			// refiner): a director failure costs nothing, and the persisted
			// prompt is the durable record of what the provider will be sent.
			const crafted = await deps.videoDirector.craftVideoPrompt({
				aspect: input.aspect,
				brief: input.brief,
				durationSeconds: input.durationSeconds,
				model: plan.modelId,
				multiShot: input.multiShot,
				organizationId: deps.subject.organizationId ?? null,
				parentEventId: deps.parentEventId,
				talking: input.talking,
				userId: deps.userId,
				voiceoverLanguage: input.voiceover?.language,
				voiceoverScript: input.voiceover?.script,
			});

			let attempt: {
				created: boolean;
				id: string;
				status: "queued" | "generating" | "succeeded" | "failed";
			};

			try {
				// Only transport-stable fields enter the hash. The model-authored
				// brief/title/quality/talking/multiShot fields can be recomposed on a
				// retried turn and must not defeat videoSubmissionId dedup; the first
				// persisted snapshot decides what renders. The clip ordinal keeps two
				// different clips requested in ONE turn from colliding.
				const requestKey = createHash("sha256")
					.update(
						JSON.stringify({
							aspect: input.aspect,
							clip,
							durationSeconds: input.durationSeconds,
							request: deps.requestKeySeed ?? options.toolCallId,
							voiceoverLanguage: input.voiceover?.language ?? null,
						}),
					)
					.digest("hex");

				attempt = await deps.mediaGenerationsRepository.insertAttempt({
					aspect: input.aspect,
					chatId: deps.chatId,
					durationSeconds: input.durationSeconds,
					kind: "text-to-video",
					model: plan.modelId,
					motion: null,
					projectId: deps.projectId,
					prompt: narration
						? appendNativeNarrationToVideoPrompt(
								crafted.prompt,
								input.voiceover,
							)
						: crafted.prompt,
					quality: plan.quality,
					requestKey,
					sourceImageUrl: null,
					sourceMediaType: null,
					talking: input.talking,
					title: input.title,
					voiceover: input.voiceover ?? null,
				});
			} catch (error) {
				logger.error(
					"Creating the video generation attempt failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The video request could not be saved on the server. Tell the " +
						"user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "failed") {
				await refundReservation(deps, billing, attempt.id);

				return {
					message:
						"This exact video request already failed. Tell the user and " +
						"wait for a new request before retrying.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "queued") {
				return {
					attemptId: attempt.id,
					message:
						"This video request was already accepted. Its existing " +
						"progress card appears in the conversation.",
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
						"This video request was already accepted. Its existing " +
						"progress or result card appears in the conversation.",
					status: "queued",
				};
			}

			const reservation = await billing.reserve(
				deps.subject,
				attempt.id,
				deps.parentEventId,
			);

			assertFixedOperationProviderExecutionAllowed(reservation);

			let handle: Awaited<ReturnType<typeof tasks.trigger>>;

			try {
				handle = await triggerGenerateVideoTask({
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
					`Trigger.dev did not confirm video generation ${attempt.id}: ${message}`,
				);

				if (isDefinitiveTriggerRejection(error)) {
					try {
						const closed =
							await deps.mediaGenerationsRepository.markAttemptFailed(
								attempt.id,
								"The background generator rejected this request. Please try again.",
								deps.userId,
							);

						if (closed) {
							await refundReservation(deps, billing, attempt.id);

							return {
								message:
									"Trigger.dev rejected the video request. Tell the user " +
									"it was not queued and offer to retry after the server " +
									"configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (settlementError) {
						logger.error(
							`Closing rejected video generation ${attempt.id} failed`,
							settlementError instanceof Error
								? settlementError.stack
								: String(settlementError),
						);
					}
				}

				// A Trigger request can be accepted even when its HTTP response is
				// lost. The attempt-based idempotency key makes a retry safe, so
				// never close a still-queued row merely because this client did not
				// receive the handle. Stale queued attempts are reconciled later.
				return {
					attemptId: attempt.id,
					message:
						"The video request is saved, but Trigger.dev did not confirm " +
						"the handoff yet. Its card will keep checking, and the same " +
						"request can be retried safely.",
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
					`Queued: the ${input.durationSeconds}-second video is rendering ` +
					"in the background. Progress and the playable result appear here " +
					"in the conversation." +
					(input.voiceover && input.talking
						? " Voice control is enabled for the on-camera speaker."
						: narration
							? " The clip will carry the requested narration."
							: input.voiceover
								? " The voiceover language is saved, but without an exact script this clip renders silent."
								: ""),
				status: "queued",
			};
		},
	});
}

/**
 * Best-effort Realtime handle: read-scoped public token for the run so the
 * chat card streams staged progress. Failure only degrades the card to
 * polling — it must never fail the queue.
 */
async function mintRealtimeHandle(
	runId: string,
): Promise<GenerateVideoOutput["realtime"]> {
	try {
		const publicAccessToken = await auth.createPublicToken({
			expirationTime: "2h",
			scopes: { read: { runs: [runId] } },
		});

		return { publicAccessToken, runId };
	} catch (error) {
		logger.warn(
			`Realtime token minting failed for run ${runId} — the chat card will rely on polling: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);

		return undefined;
	}
}

async function triggerGenerateVideoTask(payload: {
	attemptId: string;
	billingMode: "enforce" | "off";
	organizationId: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`text-to-video:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof generateVideoTask>(
				"generate-video",
				payload,
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`media-attempt:${payload.attemptId}`,
						`project:${payload.projectId}`,
					],
					// If Trigger cannot start the run within this window, its own
					// queue expires it before the DB's 30-minute queued-attempt
					// reconciler closes the card.
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
	deps: GenerateVideoToolDeps,
	billing: ImageAnimationBilling,
	attemptId: string,
): Promise<void> {
	try {
		await billing.refund(deps.subject, attemptId);
	} catch (error) {
		logger.error(
			`Refunding video generation reservation ${attemptId} failed`,
			error instanceof Error ? error.stack : String(error),
		);
	}
}

export type GenerateVideoTool = ReturnType<typeof createGenerateVideoTool>;

export const generateVideoToolSchemaOnly: Tool<
	GenerateVideoInput,
	GenerateVideoOutput
> = tool({
	inputSchema: generateVideoInputSchema,
	outputSchema: generateVideoOutputSchema,
});
