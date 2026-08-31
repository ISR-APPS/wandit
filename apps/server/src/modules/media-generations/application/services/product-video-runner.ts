// /node, not /nestjs: this orchestration also runs inside Trigger workers.

import {
	captureAiError,
	classifyAiError,
	type NormalizedAiError,
	renderAiErrorSentence,
} from "../../../ai-errors/domain";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { isTerminalFixedOperationReplay } from "../../../metering/application/services/fixed-operation-billing";
import {
	fixedGenerationStepUsage,
	type GatewayGenerationFailure,
	type GatewayGenerationMetadata,
	hasGatewayGenerationMetadata,
} from "../../../metering/domain/gateway-metering";
import {
	type AiFailurePersistenceFields,
	aiFailurePersistenceFields,
	errorForCapturedFailure,
	internalMediaFailure,
	withMediaRefundOutcome,
} from "./media-generation-failure";
import type {
	VideoBilling,
	VideoDeliveredUnits,
	VideoReservation,
} from "./video-billing";

export const USER_SAFE_PRODUCT_VIDEO_ERROR =
	"We couldn't finish this product video. Please try again in a moment.";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductVideoPayload = {
	attemptId: string;
	billingMode?: "enforce" | "off";
	organizationId?: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
};

export type ProductVideoAttemptStatus =
	| "queued"
	| "generating"
	| "succeeded"
	| "failed";

export type ProductVideoAttempt = {
	aspect: "16:9" | "9:16" | "1:1";
	completedAt: Date | null;
	durationSeconds: number;
	error: string | null;
	id: string;
	kind: "video-product";
	model: string | null;
	organizationId: string | null;
	projectDeletedAt: Date | null;
	projectId: string;
	prompt: string;
	sourceImageUrl: string;
	sourceMediaType: "image/jpeg" | "image/png";
	startedAt: Date | null;
	status: ProductVideoAttemptStatus;
	triggerRunId: string | null;
	userId: string;
	videoMediaType: string | null;
	videoUrl: string | null;
};

export type ProductVideo = {
	mediaType: string;
	url: string;
};

export type ProductVideoProviderResult =
	| ({ status: "generated" } & ProductVideo & GatewayGenerationMetadata)
	| (GatewayGenerationFailure & { failure?: NormalizedAiError })
	| { message: string; status: "unavailable" };

export type ProductVideoProgress = {
	describe?(
		attempt: Pick<ProductVideoAttempt, "aspect" | "durationSeconds" | "prompt">,
	): void;
	report: (input: {
		headline: string;
		percent: number;
		stage: "starting" | "rendering" | "publishing" | "finishing";
	}) => void;
};

export type ProductVideoRunnerDependencies = {
	capture: VideoBilling["capture"];
	claimQueued: (
		attempt: ProductVideoAttempt,
		input: { runId: string; startedAt: Date },
	) => Promise<ProductVideoAttempt | null>;
	deliveredUnitsForAttempt: (attemptId: string) => Promise<VideoDeliveredUnits>;
	fail: (
		attempt: ProductVideoAttempt,
		input: {
			completedAt: Date;
			error: string;
			expectedStatus: "queued" | "generating";
			reason: string;
		} & AiFailurePersistenceFields,
	) => Promise<boolean>;
	generate: (
		attempt: ProductVideoAttempt,
		subject: MeteringSubject,
		input: {
			onProviderGeneration: (
				generation: GatewayGenerationMetadata,
			) => Promise<void>;
			onPublishing: () => void;
			signal?: AbortSignal;
		},
	) => Promise<ProductVideoProviderResult>;
	loadAttempt: (attemptId: string) => Promise<ProductVideoAttempt | null>;
	markSucceeded: (
		attempt: ProductVideoAttempt,
		video: ProductVideo,
		completedAt: Date,
		actorUserId: string,
	) => Promise<boolean>;
	now: () => Date;
	recoverStoredVideo: (
		attempt: Pick<ProductVideoAttempt, "id" | "projectId">,
	) => Promise<ProductVideo | null>;
	refund: VideoBilling["refund"];
	reserve: VideoBilling["reserve"];
	settle: VideoBilling["settle"];
	settleExisting: VideoBilling["settleExisting"];
};

export type ProductVideoRunResult =
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
				| "reservation_failed";
			status: "failed";
	  };

/** A generating row is recovery-only; Trigger may retry but never re-render. */
export class ProductVideoSettlementPendingError extends Error {
	constructor(attemptId: string) {
		super(`Product video ${attemptId} is awaiting durable settlement`);
		this.name = "ProductVideoSettlementPendingError";
	}
}

export function parseProductVideoPayload(value: unknown): ProductVideoPayload {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError("Product video payload must be an object");
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
			"Product video payload must contain only attemptId, optional billingMode, optional organizationId, optional parentEventId, projectId, and userId",
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
		!isIdentifier(input.organizationId)
	) {
		throw new TypeError("organizationId must be a non-empty identifier");
	}
	if (
		(input.billingMode !== undefined &&
			input.billingMode !== "enforce" &&
			input.billingMode !== "off") ||
		!isIdentifier(input.userId)
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

export async function runProductVideo(
	payload: ProductVideoPayload,
	input: {
		dependencies: ProductVideoRunnerDependencies;
		progress?: ProductVideoProgress;
		runId: string;
		signal?: AbortSignal;
	},
): Promise<ProductVideoRunResult> {
	const { dependencies } = input;
	const loaded = await dependencies.loadAttempt(payload.attemptId);
	const subject = payloadSubject(payload);

	if (
		!loaded ||
		loaded.projectId !== payload.projectId ||
		loaded.organizationId !== (payload.organizationId ?? null) ||
		(loaded.organizationId === null && loaded.userId !== payload.userId)
	) {
		await dependencies.refund(subject, payload.attemptId, "video-product");
		return { reason: "ownership_mismatch", status: "failed" };
	}

	input.progress?.describe?.(loaded);
	return continueAttempt(loaded, subject, payload, input);
}

async function continueAttempt(
	attempt: ProductVideoAttempt,
	subject: MeteringSubject,
	payload: ProductVideoPayload,
	input: {
		dependencies: ProductVideoRunnerDependencies;
		progress?: ProductVideoProgress;
		runId: string;
		signal?: AbortSignal;
	},
): Promise<ProductVideoRunResult> {
	const { dependencies } = input;

	if (attempt.status === "succeeded") {
		const reservation = await reserveAttempt(
			attempt,
			subject,
			payload,
			dependencies,
		);
		await dependencies.settle(reservation, 1);
		return succeededResult(attempt, false);
	}

	if (attempt.status === "failed") {
		await settleDeliveredOrRefund(attempt, subject, dependencies);
		return { reason: "already_failed", status: "failed" };
	}

	if (attempt.projectDeletedAt !== null) {
		return failDeletedProject(attempt, subject, dependencies);
	}

	if (attempt.status === "generating") {
		const recovered = await recoverFinal(
			attempt,
			subject,
			payload,
			dependencies,
		);
		if (recovered) {
			return recovered;
		}
		throw new ProductVideoSettlementPendingError(attempt.id);
	}

	const claimed = await dependencies.claimQueued(attempt, {
		runId: input.runId,
		startedAt: dependencies.now(),
	});
	if (!claimed) {
		const raced = await dependencies.loadAttempt(attempt.id);
		if (!raced) {
			throw new Error(
				`Product video ${attempt.id} disappeared after its claim race`,
			);
		}
		return continueAttempt(raced, subject, payload, input);
	}
	if (claimed.projectDeletedAt !== null) {
		return failDeletedProject(claimed, subject, dependencies);
	}

	let reservation: VideoReservation;
	try {
		reservation = await reserveAttempt(claimed, subject, payload, dependencies);
	} catch (error) {
		let failure =
			classifyAiError(error, {
				model: claimed.model ?? undefined,
				refunded: true,
				route: "none",
				surface: "video",
			}) ??
			internalMediaFailure({
				model: claimed.model,
				refunded: true,
			});
		if (
			!(error instanceof Error && error.name === "InsufficientCreditsError")
		) {
			failure = captureProductFailure(error, failure, claimed, "none");
		}
		await failAndRefund(
			claimed,
			subject,
			dependencies,
			"reservation_failed",
			failure,
		);
		return { reason: "reservation_failed", status: "failed" };
	}

	if (isTerminalFixedOperationReplay(reservation)) {
		const recovered = await recoverFinal(
			claimed,
			subject,
			payload,
			dependencies,
		);
		if (recovered) {
			return recovered;
		}
		await persistFailure(claimed, dependencies, {
			failure: capturedProductInternalFailure(
				claimed,
				false,
				"terminal billing had no recoverable output",
			),
			reason: "terminal_billing_without_output",
			refunded: false,
		});
		return { reason: "generation_failed", status: "failed" };
	}

	input.progress?.report({
		headline: "Rendering the product commercial…",
		percent: 15,
		stage: "rendering",
	});
	let evidenceCapturedBeforeDelivery = false;
	let generated: ProductVideoProviderResult;
	try {
		generated = await dependencies.generate(claimed, subject, {
			onProviderGeneration: async (generation) => {
				await dependencies.capture(reservation, {
					providerMetadata: generation.providerMetadata,
					stepUsage: fixedGenerationStepUsage(generation.usage, 1),
				});
				evidenceCapturedBeforeDelivery = true;
			},
			onPublishing: () => {
				input.progress?.report({
					headline: "Publishing the product video…",
					percent: 94,
					stage: "publishing",
				});
			},
			...(input.signal ? { signal: input.signal } : {}),
		});
	} catch (error) {
		const refunded = !evidenceCapturedBeforeDelivery;
		let failure =
			classifyAiError(error, {
				abortSignal: input.signal,
				model: claimed.model ?? undefined,
				refunded,
				route: "vercel",
				surface: "video",
			}) ?? internalMediaFailure({ model: claimed.model, refunded });
		failure = captureProductFailure(error, failure, claimed, "vercel");
		if (evidenceCapturedBeforeDelivery) {
			await dependencies.settle(reservation, 1);
			await persistFailure(claimed, dependencies, {
				failure,
				reason: "product_provider_failed",
				refunded: false,
			});
		} else {
			await failAndRefund(
				claimed,
				subject,
				dependencies,
				"product_provider_failed",
				failure,
			);
		}
		return { reason: "generation_failed", status: "failed" };
	}

	if (generated.status !== "generated") {
		const providerUnits =
			"providerUnits" in generated && generated.providerUnits === 1 ? 1 : 0;
		const refunded = !hasGatewayGenerationMetadata(generated);
		const generatedFailure =
			"failure" in generated ? generated.failure : undefined;
		let failure = withMediaRefundOutcome(
			generatedFailure ??
				internalMediaFailure({ model: claimed.model, refunded }),
			refunded,
		);
		failure = captureProductFailure(
			errorForCapturedFailure(failure),
			failure,
			claimed,
			"vercel",
		);
		if (hasGatewayGenerationMetadata(generated)) {
			if (!evidenceCapturedBeforeDelivery) {
				await dependencies.capture(reservation, {
					providerMetadata: generated.providerMetadata,
					stepUsage: fixedGenerationStepUsage(
						generated.usage,
						providerUnits,
						providerUnits === 0 ? "refunded_failure" : undefined,
					),
				});
			}
			// Evidence-backed provider work is financially terminal before the
			// failed row becomes visible. A zero-unit settle releases the hold.
			await dependencies.settle(reservation, providerUnits);
			await persistFailure(claimed, dependencies, {
				failure,
				reason: "product_provider_failed",
				refunded: false,
			});
		} else {
			await failAndRefund(
				claimed,
				subject,
				dependencies,
				"product_provider_failed",
				failure,
			);
		}
		return { reason: "generation_failed", status: "failed" };
	}

	if (!evidenceCapturedBeforeDelivery) {
		// ProductVideo's concrete adapter always invokes the callback before its
		// R2 write. Keep a defensive capture for injected/test providers.
		await dependencies.capture(reservation, {
			providerMetadata: generated.providerMetadata,
			stepUsage: fixedGenerationStepUsage(generated.usage, 1),
		});
	}

	// Financial ordering law: a visible success may only follow settlement.
	await dependencies.settle(reservation, 1);
	const persisted = await dependencies.markSucceeded(
		claimed,
		generated,
		dependencies.now(),
		subject.actorUserId,
	);
	if (!persisted) {
		const current = await dependencies.loadAttempt(claimed.id);
		if (current?.status === "succeeded") {
			return succeededResult(current, true);
		}
		if (
			current?.projectDeletedAt !== null &&
			current?.status === "generating"
		) {
			await persistFailure(current, dependencies, {
				failure: capturedProductInternalFailure(
					current,
					false,
					"project deletion won the success transition",
				),
				reason: "project_deleted",
				refunded: false,
			});
			return { reason: "project_deleted", status: "failed" };
		}
		if (current?.status === "failed") {
			return { reason: "already_failed", status: "failed" };
		}
		throw new Error(
			`Product video ${claimed.id} lost its successful completion CAS`,
		);
	}

	return {
		mediaType: generated.mediaType,
		recovered: false,
		status: "succeeded",
		url: generated.url,
	};
}

async function reserveAttempt(
	attempt: ProductVideoAttempt,
	subject: MeteringSubject,
	payload: ProductVideoPayload,
	dependencies: ProductVideoRunnerDependencies,
): Promise<VideoReservation> {
	return dependencies.reserve(
		subject,
		attempt.id,
		1,
		payload.parentEventId,
		payload.billingMode,
		{
			audio: false,
			durationSeconds: 5,
			kind: "video-product",
			modelId: attempt.model,
		},
	);
}

async function recoverFinal(
	attempt: ProductVideoAttempt,
	subject: MeteringSubject,
	payload: ProductVideoPayload,
	dependencies: ProductVideoRunnerDependencies,
): Promise<ProductVideoRunResult | null> {
	const recovered = await dependencies.recoverStoredVideo(attempt);
	if (!recovered) {
		return null;
	}

	const settled = await dependencies.settleExisting(subject, attempt.id, 1);
	if (!settled && payload.billingMode === "enforce") {
		throw new Error(
			`Product video ${attempt.id} has stored output but no enforced metering event`,
		);
	}
	const persisted = await dependencies.markSucceeded(
		attempt,
		recovered,
		dependencies.now(),
		subject.actorUserId,
	);
	if (!persisted) {
		const current = await dependencies.loadAttempt(attempt.id);
		if (current?.status === "succeeded") {
			return succeededResult(current, true);
		}
		if (current?.status === "failed") {
			return { reason: "already_failed", status: "failed" };
		}
		throw new Error(
			`Product video ${attempt.id} lost its stored-video completion CAS`,
		);
	}

	return {
		mediaType: recovered.mediaType,
		recovered: true,
		status: "succeeded",
		url: recovered.url,
	};
}

async function failDeletedProject(
	attempt: ProductVideoAttempt,
	subject: MeteringSubject,
	dependencies: ProductVideoRunnerDependencies,
): Promise<ProductVideoRunResult> {
	const deliveredUnits = await dependencies.deliveredUnitsForAttempt(
		attempt.id,
	);
	if (deliveredUnits === 1) {
		await dependencies.settleExisting(subject, attempt.id, 1);
	}
	const refunded = deliveredUnits === 0;
	await persistFailure(attempt, dependencies, {
		failure: capturedProductInternalFailure(
			attempt,
			refunded,
			"product video project was deleted",
		),
		reason: "project_deleted",
		refunded,
	});
	if (deliveredUnits === 0) {
		await dependencies.refund(subject, attempt.id, "video-product");
	}
	return { reason: "project_deleted", status: "failed" };
}

async function settleDeliveredOrRefund(
	attempt: ProductVideoAttempt,
	subject: MeteringSubject,
	dependencies: ProductVideoRunnerDependencies,
): Promise<void> {
	const deliveredUnits = await dependencies.deliveredUnitsForAttempt(
		attempt.id,
	);
	if (deliveredUnits === 1) {
		await dependencies.settleExisting(subject, attempt.id, 1);
		return;
	}
	await dependencies.refund(subject, attempt.id, "video-product");
}

async function failAndRefund(
	attempt: ProductVideoAttempt,
	subject: MeteringSubject,
	dependencies: ProductVideoRunnerDependencies,
	reason: string,
	failure?: NormalizedAiError,
): Promise<void> {
	await persistFailure(attempt, dependencies, {
		failure:
			failure ?? internalMediaFailure({ model: attempt.model, refunded: true }),
		reason,
		refunded: true,
	});
	await dependencies.refund(subject, attempt.id, "video-product");
}

async function persistFailure(
	attempt: ProductVideoAttempt,
	dependencies: ProductVideoRunnerDependencies,
	input: {
		failure: NormalizedAiError;
		reason: string;
		refunded: boolean;
	},
): Promise<void> {
	const failure = withMediaRefundOutcome(input.failure, input.refunded);
	const failed = await dependencies.fail(attempt, {
		...aiFailurePersistenceFields(failure),
		completedAt: dependencies.now(),
		error: renderAiErrorSentence(failure),
		expectedStatus: attempt.status === "queued" ? "queued" : "generating",
		reason: input.reason,
	});
	if (failed) {
		return;
	}
	const current = await dependencies.loadAttempt(attempt.id);
	if (current?.status !== "failed" && current?.status !== "succeeded") {
		throw new Error(
			`Product video ${attempt.id} could not persist its failure`,
		);
	}
}

function captureProductFailure(
	error: unknown,
	failure: NormalizedAiError,
	attempt: ProductVideoAttempt,
	route: "vercel" | "none",
): NormalizedAiError {
	const sentryEventId = captureAiError(error, failure, {
		functionId: "video.product",
		generationId: attempt.id,
		projectId: attempt.projectId,
		refunded: failure.refunded,
		route,
		surface: "video",
		userId: attempt.userId,
	});
	return { ...failure, sentryEventId };
}

function capturedProductInternalFailure(
	attempt: ProductVideoAttempt,
	refunded: boolean,
	reason: string,
): NormalizedAiError {
	return captureProductFailure(
		new Error(`Product video runner failure: ${reason}`),
		internalMediaFailure({ model: attempt.model, refunded }),
		attempt,
		"none",
	);
}

function payloadSubject(payload: ProductVideoPayload): MeteringSubject {
	return {
		actorUserId: payload.userId,
		...(payload.organizationId
			? { organizationId: payload.organizationId }
			: {}),
	};
}

function succeededResult(
	attempt: Pick<ProductVideoAttempt, "id" | "videoMediaType" | "videoUrl">,
	recovered: boolean,
): ProductVideoRunResult {
	if (!attempt.videoMediaType || !attempt.videoUrl) {
		throw new Error(
			`Succeeded product video ${attempt.id} has no stored result`,
		);
	}
	return {
		mediaType: attempt.videoMediaType,
		recovered,
		status: "succeeded",
		url: attempt.videoUrl,
	};
}

function isIdentifier(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value.length <= 255 &&
		value.trim() === value
	);
}
