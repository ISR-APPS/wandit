import {
	type ImageGenerationAspect,
	MAX_IMAGES_PER_GENERATION,
} from "@wandit/contracts";
// /node, not /nestjs: this code also runs inside Trigger tasks and the worker.
import { Sentry } from "@wandit/observability/node";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { isTerminalFixedOperationReplay } from "../../../metering/application/services/fixed-operation-billing";
import {
	fixedGenerationStepUsage,
	type GatewayGenerationFailure,
	type GatewayGenerationMetadata,
	hasGatewayGenerationMetadata,
} from "../../../metering/domain/gateway-metering";
import type {
	ImageGenerationBilling,
	ImageGenerationReservation,
} from "./image-generation-billing";
import { mapWithConcurrency } from "./map-with-concurrency";

export const USER_SAFE_IMAGE_GENERATION_ERROR =
	"We couldn't generate these images. Please try again in a moment.";

// Keep provider fan-out bounded: image models are expensive and each attempt
// shares one billing reservation whose capture writes must remain serialized.
export const IMAGE_GENERATION_CONCURRENCY = 2;

// One image call is much faster than a video, but an attempt can hold up to
// MAX_IMAGES_PER_GENERATION calls across multiple waves; the stale window
// stays conservative and assumes every call ran alone at the timeout.
export const IMAGE_GENERATION_PROVIDER_TIMEOUT_MS = 2 * 60_000;
export const IMAGE_GENERATION_RECOVERY_GRACE_MS = 2 * 60_000;
export const IMAGE_GENERATION_STALE_GENERATING_MS =
	MAX_IMAGES_PER_GENERATION * IMAGE_GENERATION_PROVIDER_TIMEOUT_MS +
	IMAGE_GENERATION_RECOVERY_GRACE_MS;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ImageGenerationPayload = {
	attemptId: string;
	billingMode?: "enforce" | "off";
	/** Org workspace payer; null/absent = personal (pre-teams payloads). */
	organizationId?: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
};

export type ImageGenerationAttemptStatus =
	| "queued"
	| "generating"
	| "succeeded"
	| "failed";

export type ImageGenerationAttemptState = {
	aspect: ImageGenerationAspect;
	completedAt: Date | null;
	count: number;
	error: string | null;
	id: string;
	images: GeneratedImageResult[] | null;
	organizationId: string | null;
	projectDeletedAt: Date | null;
	projectId: string;
	prompt: string;
	sourceImageUrls: string[];
	spec: Record<string, unknown> | null;
	startedAt: Date | null;
	status: ImageGenerationAttemptStatus;
	title: string;
	triggerRunId: string | null;
	userId: string;
};

export type GeneratedImageResult = {
	/** 1-based generation slot. Absent only on legacy persisted rows. */
	index?: number;
	mediaType: string;
	url: string;
};

export type ImageGenerationProviderResult =
	| ({ status: "generated" } & GeneratedImageResult & GatewayGenerationMetadata)
	| GatewayGenerationFailure
	| { message: string; status: "unavailable" };

export type ImageGenerationRunnerDependencies = {
	claimQueued: (
		attempt: ImageGenerationAttemptState,
		input: { actorUserId: string; runId: string; startedAt: Date },
	) => Promise<ImageGenerationAttemptState | null>;
	fail: (
		attempt: ImageGenerationAttemptState,
		input: {
			completedAt: Date;
			error: string;
			expectedStatus: Extract<
				ImageGenerationAttemptStatus,
				"queued" | "generating"
			>;
			reason: string;
		},
	) => Promise<boolean>;
	generateOne: (
		attempt: ImageGenerationAttemptState,
		subject: MeteringSubject,
		index: number,
		signal?: AbortSignal,
		onProviderGeneration?: (
			generation: GatewayGenerationMetadata,
		) => Promise<void>,
	) => Promise<ImageGenerationProviderResult>;
	loadAttempt: (
		attemptId: string,
	) => Promise<ImageGenerationAttemptState | null>;
	markSucceeded: (
		attempt: ImageGenerationAttemptState,
		images: GeneratedImageResult[],
		completedAt: Date,
		actorUserId: string,
	) => Promise<boolean>;
	now: () => Date;
	persistProgress: (
		attempt: ImageGenerationAttemptState,
		imagesInIndexOrder: GeneratedImageResult[],
	) => Promise<boolean>;
	recoverStoredImages: (
		attempt: Pick<ImageGenerationAttemptState, "count" | "id" | "projectId">,
	) => Promise<GeneratedImageResult[] | null>;
	capture: ImageGenerationBilling["capture"];
	refund: ImageGenerationBilling["refund"];
	reserve: ImageGenerationBilling["reserve"];
	settle: ImageGenerationBilling["settle"];
	settleExisting: ImageGenerationBilling["settleExisting"];
	settlePlacement: (
		attempt: ImageGenerationAttemptState,
		images: GeneratedImageResult[],
	) => Promise<void>;
};

export type ImageGenerationRunResult =
	| {
			images: GeneratedImageResult[];
			recovered: boolean;
			status: "succeeded";
	  }
	| {
			reason:
				| "already_failed"
				| "generation_failed"
				| "ownership_mismatch"
				| "project_deleted"
				| "reservation_failed"
				| "stale_generation";
			status: "failed";
	  };

/**
 * Signals Trigger.dev to retry the same run. Thrown only after a generating
 * row is observed without its deterministic R2 objects — retrying may settle
 * the upload/DB ambiguity, but can never re-invoke the provider because only
 * the queued -> generating claim path reaches it.
 */
export class ImageGenerationSettlementPendingError extends Error {
	constructor(attemptId: string) {
		super(`Image generation ${attemptId} is awaiting durable settlement`);
		this.name = "ImageGenerationSettlementPendingError";
	}
}

/**
 * Validate the only payload shape accepted by the Trigger task — same custom
 * parser contract as image animation (schemaTask validation without adding a
 * schema-library dependency).
 */
export function parseImageGenerationPayload(
	value: unknown,
): ImageGenerationPayload {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError("Image generation payload must be an object");
	}

	const input = value as Record<string, unknown>;
	const keys = Object.keys(input).sort();

	const expectedKeys = [
		"attemptId",
		...(input.billingMode === undefined ? [] : ["billingMode"]),
		...(input.organizationId === undefined ? [] : ["organizationId"]),
		...(input.parentEventId === undefined ? [] : ["parentEventId"]),
		"projectId",
		"userId",
	].sort();

	if (
		keys.length !== expectedKeys.length ||
		keys.some((key, index) => key !== expectedKeys[index])
	) {
		throw new TypeError(
			"Image generation payload must contain only attemptId, optional billingMode, optional organizationId, optional parentEventId, projectId, and userId",
		);
	}

	if (
		typeof input.attemptId !== "string" ||
		!UUID_PATTERN.test(input.attemptId)
	) {
		throw new TypeError("attemptId must be a UUID");
	}

	if (
		typeof input.projectId !== "string" ||
		!UUID_PATTERN.test(input.projectId)
	) {
		throw new TypeError("projectId must be a UUID");
	}

	if (
		input.parentEventId !== undefined &&
		(typeof input.parentEventId !== "string" ||
			!UUID_PATTERN.test(input.parentEventId))
	) {
		throw new TypeError("parentEventId must be a UUID");
	}

	if (
		input.organizationId !== undefined &&
		input.organizationId !== null &&
		(typeof input.organizationId !== "string" ||
			input.organizationId.length === 0 ||
			input.organizationId.length > 255 ||
			input.organizationId.trim() !== input.organizationId)
	) {
		throw new TypeError("organizationId must be a non-empty identifier");
	}

	if (
		(input.billingMode !== undefined &&
			input.billingMode !== "enforce" &&
			input.billingMode !== "off") ||
		typeof input.userId !== "string" ||
		input.userId.length === 0 ||
		input.userId.length > 255 ||
		input.userId.trim() !== input.userId
	) {
		throw new TypeError("userId must be a non-empty identifier");
	}

	return {
		attemptId: input.attemptId,
		...(input.billingMode === "enforce" || input.billingMode === "off"
			? { billingMode: input.billingMode }
			: {}),
		organizationId:
			typeof input.organizationId === "string" ? input.organizationId : null,
		...(typeof input.parentEventId === "string"
			? { parentEventId: input.parentEventId }
			: {}),
		projectId: input.projectId,
		userId: input.userId,
	};
}

/**
 * Pure image-generation state machine — same shape as image animation: the
 * database CAS is the provider-call authority; once an attempt is generating,
 * every duplicate delivery and Trigger retry is recovery-only. The provider
 * pool is subset-durable: every provider-completed image is captured before
 * storage, and any uploaded indexed subset is settled and published.
 * An attempt with no durable output fails once and refunds once.
 */
/**
 * The metering subject for this run: the queue-time ACTING member (who may
 * differ from the project creator in an org workspace) paying from the
 * project's owner entity — the org pool when org-owned. The durable row's
 * userId is the project creator and must never be used as the actor.
 */
function payloadSubject(payload: ImageGenerationPayload): MeteringSubject {
	return {
		actorUserId: payload.userId,
		...(payload.organizationId
			? { organizationId: payload.organizationId }
			: {}),
	};
}

export async function runImageGeneration(
	payload: ImageGenerationPayload,
	input: {
		dependencies: ImageGenerationRunnerDependencies;
		runId: string;
		signal?: AbortSignal;
	},
): Promise<ImageGenerationRunResult> {
	const { dependencies } = input;
	const loaded = await dependencies.loadAttempt(payload.attemptId);

	// Owner-entity assert: the durable row's owner must match the queue-time
	// payload. Org attempts require the same org (the acting member may differ
	// from the project creator); personal attempts keep strict user equality.
	if (
		!loaded ||
		loaded.projectId !== payload.projectId ||
		loaded.organizationId !== (payload.organizationId ?? null) ||
		(loaded.organizationId === null && loaded.userId !== payload.userId)
	) {
		await dependencies.refund(payloadSubject(payload), payload.attemptId);

		return { reason: "ownership_mismatch", status: "failed" };
	}

	// The ownership assert above guarantees the payload and the durable row
	// agree on the paying entity; the payload adds the true acting member.
	const subject = payloadSubject(payload);

	if (loaded.status === "succeeded") {
		await settleSucceededBillingReplay(loaded, payload, dependencies);
		return settleSucceeded(loaded, loaded.images, false, dependencies);
	}

	if (loaded.projectDeletedAt !== null) {
		return settleDeletedProject(loaded, subject, dependencies);
	}

	if (loaded.status === "failed") {
		await dependencies.refund(subject, loaded.id);
		return { reason: "already_failed", status: "failed" };
	}

	if (loaded.status === "generating") {
		const recovered = await recoverStoredWithExistingSettlement(
			loaded,
			subject,
			dependencies,
			payload.billingMode,
		);
		if (recovered) {
			return recovered;
		}
		const reservation = await dependencies.reserve(
			subject,
			loaded.id,
			loaded.count,
			payload.parentEventId,
			payload.billingMode,
			{ hasSourceImages: loaded.sourceImageUrls.length > 0 },
		);
		return recoverOrSettleGenerating(
			loaded,
			subject,
			dependencies,
			reservation,
		);
	}

	const claimed = await dependencies.claimQueued(loaded, {
		actorUserId: subject.actorUserId,
		runId: input.runId,
		startedAt: dependencies.now(),
	});

	if (!claimed) {
		// A duplicate delivery won the CAS. Re-read authoritative state; this
		// branch must never fall through to the provider.
		const raced = await dependencies.loadAttempt(loaded.id);

		if (!raced) {
			throw new Error(
				`Image generation ${loaded.id} disappeared after its claim race`,
			);
		}

		if (raced.status === "succeeded") {
			await settleSucceededBillingReplay(raced, payload, dependencies);
			return settleSucceeded(raced, raced.images, false, dependencies);
		}

		if (raced.projectDeletedAt !== null) {
			return settleDeletedProject(raced, subject, dependencies);
		}

		if (raced.status === "failed") {
			await dependencies.refund(subject, raced.id);
			return { reason: "already_failed", status: "failed" };
		}

		if (raced.status === "generating") {
			const recovered = await recoverStoredWithExistingSettlement(
				raced,
				subject,
				dependencies,
				payload.billingMode,
			);
			if (recovered) {
				return recovered;
			}
			const reservation = await dependencies.reserve(
				subject,
				raced.id,
				raced.count,
				payload.parentEventId,
				payload.billingMode,
				{ hasSourceImages: raced.sourceImageUrls.length > 0 },
			);
			return recoverOrSettleGenerating(
				raced,
				subject,
				dependencies,
				reservation,
			);
		}

		throw new Error(
			`Image generation ${loaded.id} remained queued after its claim race`,
		);
	}

	if (claimed.projectDeletedAt !== null) {
		return settleDeletedProject(claimed, subject, dependencies);
	}

	let reservation: ImageGenerationReservation;

	try {
		reservation = await dependencies.reserve(
			subject,
			claimed.id,
			claimed.count,
			payload.parentEventId,
			payload.billingMode,
			{ hasSourceImages: claimed.sourceImageUrls.length > 0 },
		);
	} catch (error) {
		// Insufficient credits is an expected outcome; anything else here is
		// billing/DB infrastructure failing and must be visible.
		if (
			!(error instanceof Error && error.name === "InsufficientCreditsError")
		) {
			Sentry.captureException(error, {
				tags: { generationId: claimed.id, userId: claimed.userId },
			});
		}
		await failAndRefund(claimed, subject, dependencies, "reservation_failed");
		return { reason: "reservation_failed", status: "failed" };
	}

	if (isTerminalFixedOperationReplay(reservation)) {
		return recoverOrSettleGenerating(
			claimed,
			subject,
			dependencies,
			reservation,
		);
	}

	const imagesByIndex = new Map<number, GeneratedImageResult>();
	let capturedProviderEvidence = false;
	let capturedUnits = 0;
	let completionTail: Promise<void> = Promise.resolve();
	let failureReason: "generation_capture_failed" | "generation_failed" | null =
		null;
	let stopLaunching = false;

	const acquireCompletion = async (): Promise<() => void> => {
		const previous = completionTail;
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		completionTail = previous.then(
			() => held,
			() => held,
		);
		await previous;
		return release;
	};

	const recordFailure = (
		reason: "generation_capture_failed" | "generation_failed",
	) => {
		failureReason ??= reason;
		stopLaunching = true;
	};

	const captureGeneration = async (
		generation: GatewayGenerationMetadata,
		units: 0 | 1,
	): Promise<void> => {
		await dependencies.capture(reservation, {
			providerMetadata: generation.providerMetadata,
			// A zero-unit provider failure is refunded to the user; the marker
			// keeps its gateway cost out of the customer charge.
			stepUsage: fixedGenerationStepUsage(
				generation.usage,
				units,
				units === 0 ? "refunded_failure" : undefined,
			),
		});
		capturedProviderEvidence = true;
		capturedUnits += units;
	};

	const indexes = Array.from(
		{ length: claimed.count },
		(_, index) => index + 1,
	);
	const generationResults = await mapWithConcurrency(
		indexes,
		IMAGE_GENERATION_CONCURRENCY,
		async (index) => {
			let generated: ImageGenerationProviderResult;
			let generationCapturedBeforeDelivery = false;
			let releaseCompletion: (() => void) | null = null;
			const releaseHeldCompletion = () => {
				releaseCompletion?.();
				releaseCompletion = null;
			};

			try {
				generated = await dependencies.generateOne(
					claimed,
					subject,
					index,
					input.signal,
					async (generation) => {
						releaseCompletion = await acquireCompletion();
						try {
							await captureGeneration(generation, 1);
							generationCapturedBeforeDelivery = true;
						} catch (error) {
							releaseHeldCompletion();
							recordFailure("generation_capture_failed");
							throw error;
						}
					},
				);
			} catch (error) {
				releaseHeldCompletion();
				recordFailure("generation_failed");
				// User aborts are expected; anything else was previously invisible.
				if (!input.signal?.aborted) {
					Sentry.captureException(error, {
						tags: { generationId: claimed.id, userId: claimed.userId },
					});
				}
				return;
			}

			if (generated.status !== "generated") {
				recordFailure("generation_failed");
				// The provider's message is about to be replaced by a generic
				// "generation_failed" — keep the original reason.
				Sentry.captureMessage(`Image generation failed: ${generated.message}`, {
					level: "error",
					tags: { generationId: claimed.id, userId: claimed.userId },
				});
				const providerUnits =
					"providerUnits" in generated && generated.providerUnits === 1 ? 1 : 0;

				if (
					hasGatewayGenerationMetadata(generated) &&
					!generationCapturedBeforeDelivery
				) {
					try {
						releaseCompletion = await acquireCompletion();
						await captureGeneration(generated, providerUnits);
					} catch (error) {
						Sentry.captureException(error, {
							tags: { generationId: claimed.id, userId: claimed.userId },
						});
					}
				}
				releaseHeldCompletion();
				return;
			}

			if (!releaseCompletion) {
				releaseCompletion = await acquireCompletion();
			}

			try {
				if (!generationCapturedBeforeDelivery) {
					try {
						await captureGeneration(generated, 1);
					} catch (error) {
						recordFailure("generation_capture_failed");
						Sentry.captureException(error, {
							tags: { generationId: claimed.id, userId: claimed.userId },
						});
						return;
					}
				}

				// Real adapters capture before the primary upload. Test/legacy adapters
				// are gated above. Only now may this durable URL reach pollers.
				imagesByIndex.set(index, {
					index,
					mediaType: generated.mediaType,
					url: generated.url,
				});
				const images = imagesInGenerationOrder(imagesByIndex.values());

				try {
					const persisted = await dependencies.persistProgress(claimed, images);

					if (!persisted) {
						Sentry.captureMessage(
							`Image generation ${claimed.id} lost its progress status guard`,
							{
								level: "warning",
								tags: { generationId: claimed.id, userId: claimed.userId },
							},
						);
					}
				} catch (error) {
					// Progress is best-effort. The terminal write below remains authoritative.
					Sentry.captureException(error, {
						tags: {
							generationId: claimed.id,
							operation: "persist_image_generation_progress",
							userId: claimed.userId,
						},
					});
				}
			} finally {
				releaseHeldCompletion();
			}
		},
		{ shouldStart: () => !stopLaunching },
	);

	for (const result of generationResults) {
		if (result.status === "rejected") {
			recordFailure("generation_failed");
			Sentry.captureException(result.reason, {
				tags: { generationId: claimed.id, userId: claimed.userId },
			});
		}
	}

	const images = imagesInGenerationOrder(imagesByIndex.values());

	if (failureReason) {
		return completeSuccessfulSubsetOrFailure(
			claimed,
			subject,
			dependencies,
			reservation,
			images,
			capturedUnits,
			capturedProviderEvidence,
			failureReason,
		);
	}

	// Financial state becomes durable before the attempt is made visible as
	// succeeded. Pollers must never observe deliverable output in the gap before
	// settlement.
	await dependencies.settle(reservation);

	const persisted = await dependencies.markSucceeded(
		claimed,
		images,
		dependencies.now(),
		subject.actorUserId,
	);

	if (!persisted) {
		return resolveSuccessCasLoss(
			claimed,
			subject,
			dependencies,
			"direct generation completion",
		);
	}

	return settleSucceeded(claimed, images, false, dependencies);
}

async function completeSuccessfulSubsetOrFailure(
	attempt: ImageGenerationAttemptState,
	subject: MeteringSubject,
	dependencies: ImageGenerationRunnerDependencies,
	reservation: ImageGenerationReservation,
	images: readonly GeneratedImageResult[],
	completedUnits: number,
	hasProviderEvidence: boolean,
	reason: string,
): Promise<ImageGenerationRunResult> {
	if (images.length > 0) {
		// Partial provider output is still useful. Settle every successfully
		// captured unit, then publish the durable (possibly sparse) R2 subset.
		await dependencies.settle(reservation, completedUnits);
		const persisted = await dependencies.markSucceeded(
			attempt,
			[...images],
			dependencies.now(),
			subject.actorUserId,
		);

		if (!persisted) {
			return resolveSuccessCasLoss(
				attempt,
				subject,
				dependencies,
				"partial generation completion",
			);
		}

		return settleSucceeded(attempt, [...images], false, dependencies);
	}

	if (hasProviderEvidence || completedUnits > 0) {
		// Provider-completed image units remain billable even when a later storage
		// step fails. A no-image/error generation carries zero units and closes the
		// hold at zero while retaining its ref for provider-cost audit.
		await dependencies.settle(reservation, completedUnits);
		await failAndRefund(attempt, subject, dependencies, reason, false);
		return { reason: "generation_failed", status: "failed" };
	}

	await failAndRefund(attempt, subject, dependencies, reason);
	return { reason: "generation_failed", status: "failed" };
}

function imagesInGenerationOrder(
	images: Iterable<GeneratedImageResult>,
): GeneratedImageResult[] {
	return [...images].sort(
		(left, right) =>
			(left.index ?? Number.MAX_SAFE_INTEGER) -
			(right.index ?? Number.MAX_SAFE_INTEGER),
	);
}

async function recoverOrSettleGenerating(
	attempt: ImageGenerationAttemptState,
	subject: MeteringSubject,
	dependencies: ImageGenerationRunnerDependencies,
	reservation: ImageGenerationReservation,
): Promise<ImageGenerationRunResult> {
	const recovered = await dependencies.recoverStoredImages(attempt);

	if (recovered) {
		if (isTerminalFixedOperationReplay(reservation)) {
			// A terminal event is authoritative, but reconcile_failed may still need
			// its fixed completion repaired from newly durable storage/evidence.
			await settleExistingStoredOutput(
				attempt,
				subject,
				recovered.length,
				dependencies,
				"enforce",
			);
		} else {
			await dependencies.settle(reservation, recovered.length);
		}

		const persisted = await dependencies.markSucceeded(
			attempt,
			recovered,
			dependencies.now(),
			subject.actorUserId,
		);

		if (!persisted) {
			return resolveSuccessCasLoss(
				attempt,
				subject,
				dependencies,
				"stored-image recovery",
			);
		}

		return settleSucceeded(attempt, recovered, true, dependencies);
	}

	if (isTerminalFixedOperationReplay(reservation)) {
		// A terminal financial state cannot authorize another provider call. With
		// no deterministic object to publish, close the domain row once and retain
		// the charge/refund already chosen by metering.
		await failAndRefund(
			attempt,
			subject,
			dependencies,
			"terminal_billing",
			false,
		);
		return { reason: "generation_failed", status: "failed" };
	}

	if (!isStaleGenerating(attempt, dependencies.now())) {
		throw new ImageGenerationSettlementPendingError(attempt.id);
	}

	await failAndRefund(attempt, subject, dependencies, "stale_generation");
	return { reason: "stale_generation", status: "failed" };
}

async function recoverStoredWithExistingSettlement(
	attempt: ImageGenerationAttemptState,
	subject: MeteringSubject,
	dependencies: ImageGenerationRunnerDependencies,
	billingMode: ImageGenerationPayload["billingMode"],
): Promise<ImageGenerationRunResult | null> {
	const recovered = await dependencies.recoverStoredImages(attempt);

	if (!recovered) {
		return null;
	}

	// This path deliberately avoids reserveWithReplay: reconcile_failed is a
	// terminal core state, but already-stored provider output must still become
	// visible without repricing or creating a new hold.
	await settleExistingStoredOutput(
		attempt,
		subject,
		recovered.length,
		dependencies,
		billingMode,
	);
	const persisted = await dependencies.markSucceeded(
		attempt,
		recovered,
		dependencies.now(),
		subject.actorUserId,
	);

	if (!persisted) {
		return resolveSuccessCasLoss(
			attempt,
			subject,
			dependencies,
			"stored-image terminal recovery",
		);
	}

	return settleSucceeded(attempt, recovered, true, dependencies);
}

async function failAndRefund(
	attempt: ImageGenerationAttemptState,
	subject: MeteringSubject,
	dependencies: ImageGenerationRunnerDependencies,
	reason: string,
	shouldRefund = true,
): Promise<void> {
	const failed = await dependencies.fail(attempt, {
		completedAt: dependencies.now(),
		error: USER_SAFE_IMAGE_GENERATION_ERROR,
		expectedStatus: "generating",
		reason,
	});

	if (!failed) {
		const current = await dependencies.loadAttempt(attempt.id);

		if (current?.status === "succeeded") {
			await settleSucceeded(current, current.images, true, dependencies);
			return;
		}

		if (current?.status !== "failed") {
			throw new Error(
				`Image generation ${attempt.id} could not persist its failure`,
			);
		}
	}

	if (shouldRefund) {
		await dependencies.refund(subject, attempt.id);
	}
}

async function settleDeletedProject(
	attempt: ImageGenerationAttemptState,
	subject: MeteringSubject,
	dependencies: ImageGenerationRunnerDependencies,
	shouldRefund = true,
): Promise<ImageGenerationRunResult> {
	if (attempt.status === "succeeded") {
		// Deleting a project after delivery must not grant a free refund.
		return settleSucceeded(attempt, attempt.images, false, dependencies);
	}

	if (attempt.status === "failed") {
		if (shouldRefund) {
			await dependencies.refund(subject, attempt.id);
		}
		return { reason: "already_failed", status: "failed" };
	}

	const failed = await dependencies.fail(attempt, {
		completedAt: dependencies.now(),
		error: USER_SAFE_IMAGE_GENERATION_ERROR,
		expectedStatus: attempt.status,
		reason: "project_deleted",
	});

	if (!failed) {
		const current = await dependencies.loadAttempt(attempt.id);

		if (current?.status === "succeeded") {
			return settleSucceeded(current, current.images, false, dependencies);
		}

		if (current?.status !== "failed") {
			throw new Error(
				`Deleted-project image generation ${attempt.id} could not settle`,
			);
		}
	}

	if (shouldRefund) {
		await dependencies.refund(subject, attempt.id);
	}
	return { reason: "project_deleted", status: "failed" };
}

async function resolveSuccessCasLoss(
	attempt: ImageGenerationAttemptState,
	subject: MeteringSubject,
	dependencies: ImageGenerationRunnerDependencies,
	operation: string,
): Promise<ImageGenerationRunResult> {
	const current = await dependencies.loadAttempt(attempt.id);

	if (current?.status === "succeeded") {
		return settleSucceeded(current, current.images, true, dependencies);
	}

	if (
		current &&
		current.projectId === attempt.projectId &&
		current.userId === attempt.userId &&
		current.projectDeletedAt !== null
	) {
		return settleDeletedProject(current, subject, dependencies, false);
	}

	if (current?.status === "failed") {
		return { reason: "already_failed", status: "failed" };
	}

	throw new Error(
		`Image generation ${attempt.id} lost its ${operation} state transition`,
	);
}

async function settleSucceededBillingReplay(
	attempt: ImageGenerationAttemptState,
	payload: ImageGenerationPayload,
	dependencies: ImageGenerationRunnerDependencies,
): Promise<void> {
	if (!attempt.images || attempt.images.length === 0) {
		throw new Error(
			`Succeeded image generation ${attempt.id} has no persisted images`,
		);
	}

	// Replay the original reservation fingerprint, but never settle its default
	// requested count: a durable partial subset can have fewer stored images,
	// while captured provider evidence can prove more completed units than the
	// stored subset. The evidence-aware path preserves either terminal choice.
	await dependencies.reserve(
		payloadSubject(payload),
		attempt.id,
		attempt.count,
		payload.parentEventId,
		payload.billingMode,
		{ hasSourceImages: attempt.sourceImageUrls.length > 0 },
	);
	await settleExistingStoredOutput(
		attempt,
		payloadSubject(payload),
		attempt.images.length,
		dependencies,
		payload.billingMode,
	);
}

async function settleExistingStoredOutput(
	attempt: Pick<ImageGenerationAttemptState, "id">,
	subject: MeteringSubject,
	storedUnits: number,
	dependencies: ImageGenerationRunnerDependencies,
	billingMode: ImageGenerationPayload["billingMode"],
): Promise<void> {
	const settled = await dependencies.settleExisting(
		subject,
		attempt.id,
		storedUnits,
	);

	if (!settled && billingMode === "enforce") {
		throw new Error(
			`Image generation ${attempt.id} has stored output but no enforced metering event`,
		);
	}
}

function isStaleGenerating(
	attempt: Pick<ImageGenerationAttemptState, "startedAt">,
	now: Date,
): boolean {
	return (
		attempt.startedAt !== null &&
		now.getTime() - attempt.startedAt.getTime() >=
			IMAGE_GENERATION_STALE_GENERATING_MS
	);
}

async function settleSucceeded(
	attempt: ImageGenerationAttemptState,
	images: GeneratedImageResult[] | null,
	recovered: boolean,
	dependencies: ImageGenerationRunnerDependencies,
): Promise<ImageGenerationRunResult> {
	if (!images || images.length === 0) {
		throw new Error(
			`Succeeded image generation ${attempt.id} has no persisted images`,
		);
	}

	// Generation and its financial settlement are already durable here. If
	// placement infrastructure fails, let Trigger retry this succeeded attempt;
	// it must never regress or refund the generated asset.
	await dependencies.settlePlacement(attempt, images);

	return { images, recovered, status: "succeeded" };
}
