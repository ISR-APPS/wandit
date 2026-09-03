// /node, not /nestjs: this orchestration also runs inside Trigger workers.

import type { VideoVoiceover } from "@wandit/contracts";

import {
	captureAiError,
	classifyAiError,
	type NormalizedAiError,
	renderAiErrorSentence,
} from "../../../ai-errors/domain";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { isTerminalFixedOperationReplay } from "../../../metering/application/services/fixed-operation-billing";
import { parseImageAnimationPayload } from "./image-animation-runner";
import {
	type AiFailurePersistenceFields,
	aiFailurePersistenceFields,
	errorForCapturedFailure,
	internalMediaFailure,
	withMediaRefundOutcome,
} from "./media-generation-failure";
import {
	type VideoBilling,
	type VideoDeliveredUnits,
	type VideoReservation,
	type VideoReservationUnits,
	videoEstimateHintForAttempt,
} from "./video-billing";

export const USER_SAFE_VIDEO_EDIT_ERROR =
	"We couldn't finish editing this clip. Please try again in a moment.";
export const USER_SAFE_VIDEO_EXTENSION_ERROR =
	"We couldn't finish extending this clip. Please try again in a moment.";

export type VideoWorkflowKind = "video-edit" | "video-extension";
export type VideoWorkflowStatus =
	| "queued"
	| "generating"
	| "succeeded"
	| "failed";

export type VideoWorkflowAttempt = {
	actualDurationMs: number | null;
	aspect: "16:9" | "9:16" | "1:1";
	chainDepth: number;
	completedAt: Date | null;
	createdAt: Date;
	durationSeconds: number;
	error: string | null;
	id: string;
	kind: VideoWorkflowKind;
	model: string | null;
	organizationId: string | null;
	projectDeletedAt: Date | null;
	projectId: string;
	prompt: string;
	quality: string | null;
	sourceAttemptId: string | null;
	sourceDurationMs: number | null;
	sourceVideoMediaType: string | null;
	sourceVideoUrl: string | null;
	startedAt: Date | null;
	status: VideoWorkflowStatus;
	talking: boolean | null;
	triggerRunId: string | null;
	userId: string;
	videoMediaType: string | null;
	videoUrl: string | null;
	voiceover: VideoVoiceover | null;
};

export type VideoWorkflowVideo = {
	mediaType: string;
	url: string;
};

export type VideoWorkflowPayload = {
	attemptId: string;
	billingMode?: "enforce" | "off";
	organizationId?: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
};

export type VideoWorkflowProgress = {
	describe?: (
		attempt: Pick<
			VideoWorkflowAttempt,
			"aspect" | "durationSeconds" | "prompt" | "voiceover"
		>,
	) => void;
	report: (input: {
		headline: string;
		percent: number;
		stage:
			| "starting"
			| "rendering"
			| "rendering-leg"
			| "extracting-frame"
			| "joining"
			| "soundtrack"
			| "publishing"
			| "finishing";
	}) => void;
};

export type VideoWorkflowExecutionResult =
	| {
			deliveredUnits: VideoReservationUnits;
			status: "generated";
			video: VideoWorkflowVideo;
			warning?: string;
	  }
	| {
			deliveredUnits: VideoDeliveredUnits;
			/** False when provider evidence/delivered legs require partial settle. */
			refundable: boolean;
			reason: string;
			status: "failed";
			failure?: NormalizedAiError;
			userMessage?: string;
	  };

export type VideoWorkflowRunnerDependencies = {
	claimQueued: (
		attempt: VideoWorkflowAttempt,
		input: { runId: string; startedAt: Date },
	) => Promise<VideoWorkflowAttempt | null>;
	completedUnitsForAttempt: (
		attempt: VideoWorkflowAttempt,
	) => Promise<VideoDeliveredUnits>;
	execute: (
		attempt: VideoWorkflowAttempt,
		input: {
			progress?: VideoWorkflowProgress;
			reservation: VideoReservation;
			signal?: AbortSignal;
			subject: MeteringSubject;
		},
	) => Promise<VideoWorkflowExecutionResult>;
	fail: (
		attempt: VideoWorkflowAttempt,
		input: {
			completedAt: Date;
			error: string;
			expectedStatus: "queued" | "generating";
			reason: string;
		} & AiFailurePersistenceFields,
	) => Promise<boolean>;
	loadAttempt: (attemptId: string) => Promise<VideoWorkflowAttempt | null>;
	markSucceeded: (
		attempt: VideoWorkflowAttempt,
		video: VideoWorkflowVideo,
		completedAt: Date,
		actorUserId: string,
	) => Promise<boolean>;
	now: () => Date;
	recoverStoredVideo: (
		attempt: Pick<VideoWorkflowAttempt, "id" | "projectId">,
	) => Promise<VideoWorkflowVideo | null>;
	refund: VideoBilling["refund"];
	reserve: VideoBilling["reserve"];
	settle: VideoBilling["settle"];
	settleExisting: VideoBilling["settleExisting"];
	unitsForAttempt: (
		attempt: VideoWorkflowAttempt,
	) => Promise<VideoReservationUnits>;
};

export type VideoWorkflowRunResult =
	| {
			mediaType: string;
			recovered: boolean;
			status: "succeeded";
			url: string;
			warning?: string;
	  }
	| {
			reason:
				| "already_failed"
				| "execution_failed"
				| "ownership_mismatch"
				| "project_deleted"
				| "reservation_failed";
			status: "failed";
	  };

export class VideoWorkflowSettlementPendingError extends Error {
	constructor(attemptId: string) {
		super(`Video workflow ${attemptId} is awaiting durable settlement`);
		this.name = "VideoWorkflowSettlementPendingError";
	}
}

/** New video tasks intentionally retain the proven, minimal handoff payload. */
export function parseVideoWorkflowPayload(
	value: unknown,
): VideoWorkflowPayload {
	return parseImageAnimationPayload(value);
}

export async function runVideoWorkflow(
	payload: VideoWorkflowPayload,
	input: {
		dependencies: VideoWorkflowRunnerDependencies;
		expectedKind: VideoWorkflowKind;
		progress?: VideoWorkflowProgress;
		runId: string;
		signal?: AbortSignal;
	},
): Promise<VideoWorkflowRunResult> {
	const { dependencies } = input;
	const loaded = await dependencies.loadAttempt(payload.attemptId);

	if (loaded && loaded.kind !== input.expectedKind) {
		throw new Error(
			`${input.expectedKind} task cannot process ${loaded.kind} attempt ${loaded.id}`,
		);
	}

	if (
		!loaded ||
		loaded.projectId !== payload.projectId ||
		loaded.organizationId !== (payload.organizationId ?? null) ||
		(loaded.organizationId === null && loaded.userId !== payload.userId)
	) {
		await dependencies.refund(
			payloadSubject(payload),
			payload.attemptId,
			input.expectedKind,
		);
		return { reason: "ownership_mismatch", status: "failed" };
	}

	const subject = payloadSubject(payload);
	input.progress?.describe?.(loaded);
	return continueAttempt(loaded, subject, payload, input);
}

async function continueAttempt(
	attempt: VideoWorkflowAttempt,
	subject: MeteringSubject,
	payload: VideoWorkflowPayload,
	input: {
		dependencies: VideoWorkflowRunnerDependencies;
		expectedKind: VideoWorkflowKind;
		progress?: VideoWorkflowProgress;
		runId: string;
		signal?: AbortSignal;
	},
): Promise<VideoWorkflowRunResult> {
	const { dependencies } = input;
	const units = await dependencies.unitsForAttempt(attempt);

	if (attempt.status === "succeeded") {
		const reservation = await dependencies.reserve(
			subject,
			attempt.id,
			units,
			payload.parentEventId,
			payload.billingMode,
			videoEstimateHintForAttempt(attempt, units),
		);
		await dependencies.settle(reservation, units);
		return succeededResult(attempt, false);
	}

	if (attempt.status === "failed") {
		const completedUnits = await dependencies.completedUnitsForAttempt(attempt);
		if (completedUnits === 0) {
			await dependencies.refund(subject, attempt.id, attempt.kind);
		} else {
			await dependencies.settleExisting(subject, attempt.id, completedUnits);
		}
		return { reason: "already_failed", status: "failed" };
	}

	if (attempt.projectDeletedAt !== null) {
		return failDeletedProject(attempt, subject, dependencies);
	}

	if (attempt.status === "generating") {
		const recovered = await recoverFinal(attempt, subject, units, dependencies);
		if (recovered) {
			return recovered;
		}

		// An edit has one opaque provider call. Once the parent is generating,
		// only its deterministic final object may prove completion. Extensions
		// can continue because each queued leg has its own provider-call CAS.
		if (attempt.kind === "video-edit") {
			throw new VideoWorkflowSettlementPendingError(attempt.id);
		}
	}

	let active = attempt;
	if (attempt.status === "queued") {
		const claimed = await dependencies.claimQueued(attempt, {
			runId: input.runId,
			startedAt: dependencies.now(),
		});

		if (!claimed) {
			const raced = await dependencies.loadAttempt(attempt.id);
			if (!raced) {
				throw new Error(
					`Video workflow ${attempt.id} disappeared after its claim race`,
				);
			}
			return continueAttempt(raced, subject, payload, input);
		}
		active = claimed;
	}

	let reservation: VideoReservation;
	try {
		reservation = await dependencies.reserve(
			subject,
			active.id,
			units,
			payload.parentEventId,
			payload.billingMode,
			videoEstimateHintForAttempt(active, units),
		);
	} catch (error) {
		let failure =
			classifyAiError(error, {
				model: active.model ?? undefined,
				refunded: true,
				route: "none",
				surface: "video",
			}) ??
			internalMediaFailure({
				model: active.model,
				refunded: true,
			});
		if (
			!(error instanceof Error && error.name === "InsufficientCreditsError")
		) {
			failure = captureWorkflowFailure(error, failure, active, "none");
		}
		await failAndBill(active, subject, dependencies, {
			deliveredUnits: 0,
			failure,
			reason: "reservation_failed",
			refundable: true,
		});
		return { reason: "reservation_failed", status: "failed" };
	}

	if (isTerminalFixedOperationReplay(reservation)) {
		const recovered = await recoverFinal(active, subject, units, dependencies);
		if (recovered) {
			return recovered;
		}
		const completedUnits = await dependencies.completedUnitsForAttempt(active);
		await failAndBill(active, subject, dependencies, {
			deliveredUnits: completedUnits,
			failure: capturedWorkflowInternalFailure(
				active,
				false,
				"terminal billing had no recoverable output",
			),
			reason: "terminal_billing_without_output",
			refundable: false,
			reservation,
		});
		return { reason: "execution_failed", status: "failed" };
	}

	let executed: VideoWorkflowExecutionResult;
	try {
		executed = await dependencies.execute(active, {
			...(input.progress ? { progress: input.progress } : {}),
			reservation,
			...(input.signal ? { signal: input.signal } : {}),
			subject,
		});
	} catch (error) {
		if (error instanceof VideoWorkflowSettlementPendingError) {
			throw error;
		}
		// Infrastructure/ffmpeg/storage exceptions are retryable. Keep the
		// parent generating so the next delivery can recover a final object, raw
		// provider output, normalized segment, or the next queued leg. Only
		// explicit classified execution results terminal-fail the attempt.
		throw error;
	}

	if (executed.status === "failed") {
		const durableUnits = await dependencies.completedUnitsForAttempt(active);
		const deliveredUnits = maxDeliveredUnits(
			executed.deliveredUnits,
			durableUnits,
		);
		const refundable = executed.refundable && deliveredUnits === 0;
		let failure = withMediaRefundOutcome(
			executed.failure ??
				internalMediaFailure({ model: active.model, refunded: refundable }),
			refundable,
		);
		failure = captureWorkflowFailure(
			errorForCapturedFailure(failure),
			failure,
			active,
			"vercel",
		);
		await failAndBill(active, subject, dependencies, {
			...executed,
			deliveredUnits,
			failure,
			refundable,
			reservation,
		});
		return { reason: "execution_failed", status: "failed" };
	}

	await dependencies.settle(reservation, executed.deliveredUnits);
	const persisted = await dependencies.markSucceeded(
		active,
		executed.video,
		dependencies.now(),
		subject.actorUserId,
	);
	if (!persisted) {
		const current = await dependencies.loadAttempt(active.id);
		if (current?.status === "succeeded") {
			return succeededResult(current, false, executed.warning);
		}
		throw new Error(
			`Video workflow ${active.id} lost its successful completion CAS`,
		);
	}

	return {
		mediaType: executed.video.mediaType,
		recovered: false,
		status: "succeeded",
		url: executed.video.url,
		...(executed.warning ? { warning: executed.warning } : {}),
	};
}

async function recoverFinal(
	attempt: VideoWorkflowAttempt,
	subject: MeteringSubject,
	units: VideoReservationUnits,
	dependencies: VideoWorkflowRunnerDependencies,
): Promise<VideoWorkflowRunResult | null> {
	const recovered = await dependencies.recoverStoredVideo(attempt);
	if (!recovered) {
		return null;
	}

	await dependencies.settleExisting(subject, attempt.id, units);
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
		throw new Error(
			`Video workflow ${attempt.id} lost its stored-video completion CAS`,
		);
	}

	return {
		mediaType: recovered.mediaType,
		recovered: true,
		status: "succeeded",
		url: recovered.url,
	};
}

async function failAndBill(
	attempt: VideoWorkflowAttempt,
	subject: MeteringSubject,
	dependencies: VideoWorkflowRunnerDependencies,
	input: {
		deliveredUnits: VideoDeliveredUnits;
		failure?: NormalizedAiError;
		reason: string;
		refundable: boolean;
		reservation?: VideoReservation;
		userMessage?: string;
	},
): Promise<void> {
	// Provider-completion evidence must become financially terminal before the
	// failed row is visible. Otherwise a crash between these writes lets a
	// failed replay take the full-refund path despite delivered provider work.
	if (!input.refundable && input.reservation) {
		await dependencies.settle(input.reservation, input.deliveredUnits);
	}
	const failure = withMediaRefundOutcome(
		input.failure ??
			internalMediaFailure({
				model: attempt.model,
				refunded: input.refundable,
			}),
		input.refundable,
	);

	const failed = await dependencies.fail(attempt, {
		...aiFailurePersistenceFields(failure),
		completedAt: dependencies.now(),
		error: input.userMessage ?? renderAiErrorSentence(failure),
		expectedStatus: "generating",
		reason: input.reason,
	});

	if (!failed) {
		const current = await dependencies.loadAttempt(attempt.id);
		if (current?.status === "succeeded") {
			return;
		}
		if (current?.status !== "failed") {
			throw new Error(
				`Video workflow ${attempt.id} could not persist its failure`,
			);
		}
	}

	if (input.refundable) {
		await dependencies.refund(subject, attempt.id, attempt.kind);
	}
}

async function failDeletedProject(
	attempt: VideoWorkflowAttempt,
	subject: MeteringSubject,
	dependencies: VideoWorkflowRunnerDependencies,
): Promise<VideoWorkflowRunResult> {
	const completedUnits = await dependencies.completedUnitsForAttempt(attempt);
	const refunded = completedUnits === 0;
	if (completedUnits !== 0) {
		// Settle durable provider work before exposing the failed parent; a crash
		// after the CAS must never make a later poll take the full-refund path.
		await dependencies.settleExisting(subject, attempt.id, completedUnits);
	}
	const failure = capturedWorkflowInternalFailure(
		attempt,
		refunded,
		"video workflow project was deleted",
	);
	const failed = await dependencies.fail(attempt, {
		...aiFailurePersistenceFields(failure),
		completedAt: dependencies.now(),
		error: renderAiErrorSentence(failure),
		expectedStatus: attempt.status === "queued" ? "queued" : "generating",
		reason: "project_deleted",
	});
	if (!failed) {
		const current = await dependencies.loadAttempt(attempt.id);
		if (current?.status === "succeeded") {
			return succeededResult(current, false);
		}
	}
	if (completedUnits === 0) {
		await dependencies.refund(subject, attempt.id, attempt.kind);
	}
	return { reason: "project_deleted", status: "failed" };
}

function captureWorkflowFailure(
	error: unknown,
	failure: NormalizedAiError,
	attempt: VideoWorkflowAttempt,
	route: "vercel" | "none",
): NormalizedAiError {
	const sentryEventId = captureAiError(error, failure, {
		functionId:
			attempt.kind === "video-edit" ? "video.edit" : "video.extension",
		generationId: attempt.id,
		projectId: attempt.projectId,
		refunded: failure.refunded,
		route,
		surface: "video",
		userId: attempt.userId,
	});
	return { ...failure, sentryEventId };
}

function capturedWorkflowInternalFailure(
	attempt: VideoWorkflowAttempt,
	refunded: boolean,
	reason: string,
): NormalizedAiError {
	return captureWorkflowFailure(
		new Error(`Video workflow runner failure: ${reason}`),
		internalMediaFailure({ model: attempt.model, refunded }),
		attempt,
		"none",
	);
}

function payloadSubject(payload: VideoWorkflowPayload): MeteringSubject {
	return {
		actorUserId: payload.userId,
		...(payload.organizationId
			? { organizationId: payload.organizationId }
			: {}),
	};
}

function succeededResult(
	attempt: VideoWorkflowAttempt,
	recovered: boolean,
	warning?: string,
): VideoWorkflowRunResult {
	if (!attempt.videoUrl || !attempt.videoMediaType) {
		throw new Error(
			`Succeeded video workflow ${attempt.id} is missing its result`,
		);
	}
	return {
		mediaType: attempt.videoMediaType,
		recovered,
		status: "succeeded",
		url: attempt.videoUrl,
		...(warning ? { warning } : {}),
	};
}

function maxDeliveredUnits(
	first: VideoDeliveredUnits,
	second: VideoDeliveredUnits,
): VideoDeliveredUnits {
	return Math.max(first, second) as VideoDeliveredUnits;
}
