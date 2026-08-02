// /node, not /nestjs: this code also runs inside Trigger tasks and the worker.
import { Sentry } from "@wandit/observability/node";

import { isTerminalFixedOperationReplay } from "../../../metering/application/services/fixed-operation-billing";
import {
	fixedGenerationStepUsage,
	type GatewayGenerationFailure,
	type GatewayGenerationMetadata,
	hasGatewayGenerationMetadata,
} from "../../../metering/domain/gateway-metering";
import type {
	ImageAnimationBilling,
	ImageAnimationReservation,
} from "./image-animation-billing";

export const USER_SAFE_IMAGE_ANIMATION_ERROR =
	"We couldn't animate this image. Please try again in a moment.";

export const IMAGE_ANIMATION_PROVIDER_TIMEOUT_MS = 5 * 60_000;
export const IMAGE_ANIMATION_RECOVERY_GRACE_MS = 2 * 60_000;
export const IMAGE_ANIMATION_STALE_GENERATING_MS =
	IMAGE_ANIMATION_PROVIDER_TIMEOUT_MS + IMAGE_ANIMATION_RECOVERY_GRACE_MS;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ImageAnimationPayload = {
	attemptId: string;
	billingMode?: "enforce" | "off";
	parentEventId?: string;
	projectId: string;
	userId: string;
};

export type ImageAnimationAttemptStatus =
	| "queued"
	| "generating"
	| "succeeded"
	| "failed";

export type ImageAnimationAttempt = {
	aspect: "16:9" | "9:16" | "1:1";
	completedAt: Date | null;
	error: string | null;
	id: string;
	motion: "subtle" | "balanced" | "dynamic";
	projectDeletedAt: Date | null;
	projectId: string;
	prompt: string;
	sourceImageUrl: string;
	startedAt: Date | null;
	status: ImageAnimationAttemptStatus;
	triggerRunId: string | null;
	userId: string;
	videoMediaType: string | null;
	videoUrl: string | null;
};

export type ImageAnimationVideo = {
	mediaType: string;
	url: string;
};

export type ImageAnimationProviderResult =
	| ({ status: "generated" } & ImageAnimationVideo & GatewayGenerationMetadata)
	| GatewayGenerationFailure
	| { message: string; status: "unavailable" };

export type ImageAnimationRunnerDependencies = {
	claimQueued: (
		attempt: ImageAnimationAttempt,
		input: { runId: string; startedAt: Date },
	) => Promise<ImageAnimationAttempt | null>;
	fail: (
		attempt: ImageAnimationAttempt,
		input: {
			completedAt: Date;
			error: string;
			expectedStatus: Extract<
				ImageAnimationAttemptStatus,
				"queued" | "generating"
			>;
			reason: string;
		},
	) => Promise<boolean>;
	generate: (
		attempt: ImageAnimationAttempt,
		signal?: AbortSignal,
		onProviderGeneration?: (
			generation: GatewayGenerationMetadata,
		) => Promise<void>,
	) => Promise<ImageAnimationProviderResult>;
	loadAttempt: (attemptId: string) => Promise<ImageAnimationAttempt | null>;
	markSucceeded: (
		attempt: ImageAnimationAttempt,
		video: ImageAnimationVideo,
		completedAt: Date,
	) => Promise<boolean>;
	now: () => Date;
	recoverStoredVideo: (
		attempt: Pick<ImageAnimationAttempt, "id" | "projectId">,
	) => Promise<ImageAnimationVideo | null>;
	capture: ImageAnimationBilling["capture"];
	refund: ImageAnimationBilling["refund"];
	reserve: ImageAnimationBilling["reserve"];
	settle: ImageAnimationBilling["settle"];
	settleExisting: ImageAnimationBilling["settleExisting"];
};

export type ImageAnimationRunResult =
	| {
			mediaType: string;
			recovered: boolean;
			status: "succeeded";
			url: string;
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
 * Signals Trigger.dev to retry the same run. It is intentionally thrown only
 * after a generating row is observed without its deterministic R2 object.
 * Retrying may settle the upload/DB ambiguity, but can never invoke the
 * provider because only the queued -> generating claim path reaches it.
 */
export class ImageAnimationSettlementPendingError extends Error {
	constructor(attemptId: string) {
		super(`Image animation ${attemptId} is awaiting durable settlement`);
		this.name = "ImageAnimationSettlementPendingError";
	}
}

/**
 * Validate the only payload shape accepted by the Trigger task. A custom
 * parser keeps schemaTask runtime validation without adding an undeclared
 * schema-library dependency to the server package.
 */
export function parseImageAnimationPayload(
	value: unknown,
): ImageAnimationPayload {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError("Image animation payload must be an object");
	}

	const input = value as Record<string, unknown>;
	const keys = Object.keys(input).sort();

	const expectedKeys = [
		"attemptId",
		...(input.billingMode === undefined ? [] : ["billingMode"]),
		...(input.parentEventId === undefined ? [] : ["parentEventId"]),
		"projectId",
		"userId",
	].sort();

	if (
		keys.length !== expectedKeys.length ||
		keys.some((key, index) => key !== expectedKeys[index])
	) {
		throw new TypeError(
			"Image animation payload must contain only attemptId, optional billingMode, optional parentEventId, projectId, and userId",
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
		...(typeof input.parentEventId === "string"
			? { parentEventId: input.parentEventId }
			: {}),
		projectId: input.projectId,
		userId: input.userId,
	};
}

/**
 * Pure image-animation state machine.
 *
 * The database CAS is the provider-call authority. Once an attempt is
 * generating, every duplicate delivery and Trigger retry is recovery-only:
 * check deterministic storage, observe a terminal row, or eventually fail
 * and refund. There is deliberately no path from generating back to the
 * provider.
 */
export async function runImageAnimation(
	payload: ImageAnimationPayload,
	input: {
		dependencies: ImageAnimationRunnerDependencies;
		runId: string;
		signal?: AbortSignal;
	},
): Promise<ImageAnimationRunResult> {
	const { dependencies } = input;
	const loaded = await dependencies.loadAttempt(payload.attemptId);

	if (
		!loaded ||
		loaded.projectId !== payload.projectId ||
		loaded.userId !== payload.userId
	) {
		// The payload is retained precisely so deleted/mismatched handoffs can
		// settle a prior reservation without trusting it for provider inputs.
		await dependencies.refund(payload.userId, payload.attemptId);

		return { reason: "ownership_mismatch", status: "failed" };
	}

	if (loaded.status === "succeeded") {
		const reservation = await dependencies.reserve(
			loaded.userId,
			loaded.id,
			payload.parentEventId,
			payload.billingMode,
		);
		await dependencies.settle(reservation);
		return succeededResult(loaded, false);
	}

	if (loaded.projectDeletedAt !== null) {
		return settleDeletedProject(loaded, dependencies);
	}

	if (loaded.status === "failed") {
		await dependencies.refund(loaded.userId, loaded.id);
		return { reason: "already_failed", status: "failed" };
	}

	if (loaded.status === "generating") {
		const recovered = await recoverStoredVideoWithExistingSettlement(
			loaded,
			dependencies,
			payload.billingMode,
		);
		if (recovered) {
			return recovered;
		}
		const reservation = await dependencies.reserve(
			loaded.userId,
			loaded.id,
			payload.parentEventId,
			payload.billingMode,
		);
		return recoverOrSettleGenerating(loaded, dependencies, reservation);
	}

	const claimed = await dependencies.claimQueued(loaded, {
		runId: input.runId,
		startedAt: dependencies.now(),
	});

	if (!claimed) {
		// A duplicate delivery won the CAS. Re-read authoritative state; this
		// branch must never fall through to the provider.
		const raced = await dependencies.loadAttempt(loaded.id);

		if (!raced) {
			throw new Error(
				`Image animation ${loaded.id} disappeared after its claim race`,
			);
		}

		if (raced.status === "succeeded") {
			const reservation = await dependencies.reserve(
				raced.userId,
				raced.id,
				payload.parentEventId,
				payload.billingMode,
			);
			await dependencies.settle(reservation);
			return succeededResult(raced, false);
		}

		if (raced.projectDeletedAt !== null) {
			return settleDeletedProject(raced, dependencies);
		}

		if (raced.status === "failed") {
			await dependencies.refund(raced.userId, raced.id);
			return { reason: "already_failed", status: "failed" };
		}

		if (raced.status === "generating") {
			const recovered = await recoverStoredVideoWithExistingSettlement(
				raced,
				dependencies,
				payload.billingMode,
			);
			if (recovered) {
				return recovered;
			}
			const reservation = await dependencies.reserve(
				raced.userId,
				raced.id,
				payload.parentEventId,
				payload.billingMode,
			);
			return recoverOrSettleGenerating(raced, dependencies, reservation);
		}

		throw new Error(
			`Image animation ${loaded.id} remained queued after its claim race`,
		);
	}

	if (claimed.projectDeletedAt !== null) {
		return settleDeletedProject(claimed, dependencies);
	}

	let reservation: ImageAnimationReservation;

	try {
		reservation = await dependencies.reserve(
			claimed.userId,
			claimed.id,
			payload.parentEventId,
			payload.billingMode,
		);
	} catch (error) {
		// Insufficient credits is an expected outcome; anything else here is
		// billing/DB infrastructure failing and must be visible.
		if (
			!(error instanceof Error && error.name === "InsufficientCreditsError")
		) {
			Sentry.captureException(error, {
				tags: { animationId: claimed.id, userId: claimed.userId },
			});
		}
		await failAndRefund(claimed, dependencies, "reservation_failed");
		return { reason: "reservation_failed", status: "failed" };
	}

	if (isTerminalFixedOperationReplay(reservation)) {
		return recoverOrSettleGenerating(claimed, dependencies, reservation);
	}

	let generated: ImageAnimationProviderResult;
	let generationCapturedBeforeDelivery = false;

	try {
		generated = await dependencies.generate(
			claimed,
			input.signal,
			async (generation) => {
				await dependencies.capture(reservation, {
					providerMetadata: generation.providerMetadata,
					stepUsage: fixedGenerationStepUsage(generation.usage, 1),
				});
				generationCapturedBeforeDelivery = true;
			},
		);
	} catch (error) {
		// User aborts are expected; anything else was previously invisible.
		if (!input.signal?.aborted) {
			Sentry.captureException(error, {
				tags: { animationId: claimed.id, userId: claimed.userId },
			});
		}
		await failAndRefund(claimed, dependencies, "generation_failed");
		return { reason: "generation_failed", status: "failed" };
	}

	if (generated.status !== "generated") {
		// The provider's message is about to be replaced by a generic
		// "generation_failed" — keep the original reason.
		Sentry.captureMessage(`Image animation failed: ${generated.message}`, {
			level: "error",
			tags: { animationId: claimed.id, userId: claimed.userId },
		});
		const providerUnits =
			"providerUnits" in generated && generated.providerUnits === 1 ? 1 : 0;
		if (hasGatewayGenerationMetadata(generated)) {
			if (!generationCapturedBeforeDelivery) {
				await dependencies.capture(reservation, {
					providerMetadata: generated.providerMetadata,
					stepUsage: fixedGenerationStepUsage(generated.usage, providerUnits),
				});
			}
			await dependencies.settle(reservation, providerUnits);
		}
		await failAndRefund(
			claimed,
			dependencies,
			"generation_failed",
			!hasGatewayGenerationMetadata(generated),
		);
		return { reason: "generation_failed", status: "failed" };
	}

	if (!generationCapturedBeforeDelivery) {
		try {
			await dependencies.capture(reservation, {
				providerMetadata: generated.providerMetadata,
				stepUsage: fixedGenerationStepUsage(generated.usage, 1),
			});
		} catch (error) {
			Sentry.captureException(error, {
				tags: { animationId: claimed.id, userId: claimed.userId },
			});
			await failAndRefund(
				claimed,
				dependencies,
				"generation_capture_failed",
				false,
			);
			return { reason: "generation_failed", status: "failed" };
		}
	}

	// Do not publish a succeeded row until the financial settlement is durable.
	await dependencies.settle(reservation);

	const persisted = await dependencies.markSucceeded(
		claimed,
		generated,
		dependencies.now(),
	);

	if (!persisted) {
		return resolveSuccessCasLoss(
			claimed,
			dependencies,
			reservation,
			"direct generation completion",
		);
	}

	return {
		mediaType: generated.mediaType,
		recovered: false,
		status: "succeeded",
		url: generated.url,
	};
}

async function recoverOrSettleGenerating(
	attempt: ImageAnimationAttempt,
	dependencies: ImageAnimationRunnerDependencies,
	reservation: ImageAnimationReservation,
): Promise<ImageAnimationRunResult> {
	const recovered = await dependencies.recoverStoredVideo(attempt);

	if (recovered) {
		if (!isTerminalFixedOperationReplay(reservation)) {
			await dependencies.settle(reservation);
		}

		const persisted = await dependencies.markSucceeded(
			attempt,
			recovered,
			dependencies.now(),
		);

		if (!persisted) {
			return resolveSuccessCasLoss(
				attempt,
				dependencies,
				reservation,
				"stored-video recovery",
			);
		}

		return {
			mediaType: recovered.mediaType,
			recovered: true,
			status: "succeeded",
			url: recovered.url,
		};
	}

	if (isTerminalFixedOperationReplay(reservation)) {
		await failAndRefund(attempt, dependencies, "terminal_billing", false);
		return { reason: "generation_failed", status: "failed" };
	}

	if (!isStaleGenerating(attempt, dependencies.now())) {
		throw new ImageAnimationSettlementPendingError(attempt.id);
	}

	await failAndRefund(attempt, dependencies, "stale_generation");
	return { reason: "stale_generation", status: "failed" };
}

async function recoverStoredVideoWithExistingSettlement(
	attempt: ImageAnimationAttempt,
	dependencies: ImageAnimationRunnerDependencies,
	billingMode: ImageAnimationPayload["billingMode"],
): Promise<ImageAnimationRunResult | null> {
	const recovered = await dependencies.recoverStoredVideo(attempt);

	if (!recovered) {
		return null;
	}

	const settled = await dependencies.settleExisting(attempt.userId, attempt.id);
	if (!settled && billingMode === "enforce") {
		throw new Error(
			`Image animation ${attempt.id} has stored output but no enforced metering event`,
		);
	}
	const persisted = await dependencies.markSucceeded(
		attempt,
		recovered,
		dependencies.now(),
	);

	if (!persisted) {
		const current = await dependencies.loadAttempt(attempt.id);
		if (current?.status === "succeeded") {
			return succeededResult(current, true);
		}
		if (
			current &&
			current.projectId === attempt.projectId &&
			current.userId === attempt.userId &&
			current.projectDeletedAt !== null
		) {
			return settleDeletedProject(current, dependencies, false);
		}
		if (current?.status === "failed") {
			return { reason: "already_failed", status: "failed" };
		}
		throw new Error(
			`Image animation ${attempt.id} lost its stored-video completion state`,
		);
	}

	return {
		mediaType: recovered.mediaType,
		recovered: true,
		status: "succeeded",
		url: recovered.url,
	};
}

async function failAndRefund(
	attempt: ImageAnimationAttempt,
	dependencies: ImageAnimationRunnerDependencies,
	reason: string,
	shouldRefund = true,
): Promise<void> {
	const failed = await dependencies.fail(attempt, {
		completedAt: dependencies.now(),
		error: USER_SAFE_IMAGE_ANIMATION_ERROR,
		expectedStatus: "generating",
		reason,
	});

	if (!failed) {
		const current = await dependencies.loadAttempt(attempt.id);

		if (current?.status === "succeeded") {
			return;
		}

		if (current?.status !== "failed") {
			throw new Error(
				`Image animation ${attempt.id} could not persist its failure`,
			);
		}
	}

	if (shouldRefund) {
		await dependencies.refund(attempt.userId, attempt.id);
	}
}

async function settleDeletedProject(
	attempt: ImageAnimationAttempt,
	dependencies: ImageAnimationRunnerDependencies,
	shouldRefund = true,
): Promise<ImageAnimationRunResult> {
	if (attempt.status === "succeeded") {
		// Deleting a project after a result was delivered must not grant a free
		// refund. The immutable media attempt remains the billing authority.
		return succeededResult(attempt, false);
	}

	if (attempt.status === "failed") {
		if (shouldRefund) {
			await dependencies.refund(attempt.userId, attempt.id);
		}
		return { reason: "already_failed", status: "failed" };
	}

	const failed = await dependencies.fail(attempt, {
		completedAt: dependencies.now(),
		error: USER_SAFE_IMAGE_ANIMATION_ERROR,
		expectedStatus: attempt.status,
		reason: "project_deleted",
	});

	if (!failed) {
		const current = await dependencies.loadAttempt(attempt.id);

		if (current?.status === "succeeded") {
			return succeededResult(current, false);
		}

		if (current?.status !== "failed") {
			throw new Error(
				`Deleted-project image animation ${attempt.id} could not settle`,
			);
		}
	}

	if (shouldRefund) {
		await dependencies.refund(attempt.userId, attempt.id);
	}
	return { reason: "project_deleted", status: "failed" };
}

async function resolveSuccessCasLoss(
	attempt: ImageAnimationAttempt,
	dependencies: ImageAnimationRunnerDependencies,
	reservation: ImageAnimationReservation,
	operation: string,
): Promise<ImageAnimationRunResult> {
	const current = await dependencies.loadAttempt(attempt.id);

	if (current?.status === "succeeded") {
		await dependencies.settle(reservation);
		return succeededResult(current, true);
	}

	if (
		current &&
		current.projectId === attempt.projectId &&
		current.userId === attempt.userId &&
		current.projectDeletedAt !== null
	) {
		return settleDeletedProject(current, dependencies, false);
	}

	if (current?.status === "failed") {
		return { reason: "already_failed", status: "failed" };
	}

	throw new Error(
		`Image animation ${attempt.id} lost its ${operation} state transition`,
	);
}

function isStaleGenerating(
	attempt: Pick<ImageAnimationAttempt, "startedAt">,
	now: Date,
): boolean {
	return (
		attempt.startedAt !== null &&
		now.getTime() - attempt.startedAt.getTime() >=
			IMAGE_ANIMATION_STALE_GENERATING_MS
	);
}

function succeededResult(
	attempt: Pick<ImageAnimationAttempt, "id" | "videoMediaType" | "videoUrl">,
	recovered: boolean,
): ImageAnimationRunResult {
	if (!attempt.videoMediaType || !attempt.videoUrl) {
		throw new Error(
			`Succeeded image animation ${attempt.id} has no persisted video`,
		);
	}

	return {
		mediaType: attempt.videoMediaType,
		recovered,
		status: "succeeded",
		url: attempt.videoUrl,
	};
}
