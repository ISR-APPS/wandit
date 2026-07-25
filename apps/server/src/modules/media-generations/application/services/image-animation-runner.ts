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
	| ({ status: "generated" } & ImageAnimationVideo)
	| { message: string; status: "failed" | "unavailable" };

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
		},
	) => Promise<boolean>;
	generate: (
		attempt: ImageAnimationAttempt,
		signal?: AbortSignal,
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
	refund: (userId: string, attemptId: string) => Promise<void>;
	reserve: (userId: string, attemptId: string) => Promise<void>;
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

	if (
		keys.length !== 3 ||
		keys[0] !== "attemptId" ||
		keys[1] !== "projectId" ||
		keys[2] !== "userId"
	) {
		throw new TypeError(
			"Image animation payload must contain only attemptId, projectId, and userId",
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
		typeof input.userId !== "string" ||
		input.userId.length === 0 ||
		input.userId.length > 255 ||
		input.userId.trim() !== input.userId
	) {
		throw new TypeError("userId must be a non-empty identifier");
	}

	return {
		attemptId: input.attemptId,
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
		return recoverOrSettleGenerating(loaded, dependencies);
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
			return recoverOrSettleGenerating(raced, dependencies);
		}

		throw new Error(
			`Image animation ${loaded.id} remained queued after its claim race`,
		);
	}

	if (claimed.projectDeletedAt !== null) {
		return settleDeletedProject(claimed, dependencies);
	}

	try {
		await dependencies.reserve(claimed.userId, claimed.id);
	} catch {
		await failAndRefund(claimed, dependencies);
		return { reason: "reservation_failed", status: "failed" };
	}

	let generated: ImageAnimationProviderResult;

	try {
		generated = await dependencies.generate(claimed, input.signal);
	} catch {
		await failAndRefund(claimed, dependencies);
		return { reason: "generation_failed", status: "failed" };
	}

	if (generated.status !== "generated") {
		await failAndRefund(claimed, dependencies);
		return { reason: "generation_failed", status: "failed" };
	}

	const persisted = await dependencies.markSucceeded(
		claimed,
		generated,
		dependencies.now(),
	);

	if (!persisted) {
		return resolveSuccessCasLoss(
			claimed,
			dependencies,
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
): Promise<ImageAnimationRunResult> {
	const recovered = await dependencies.recoverStoredVideo(attempt);

	if (recovered) {
		const persisted = await dependencies.markSucceeded(
			attempt,
			recovered,
			dependencies.now(),
		);

		if (!persisted) {
			return resolveSuccessCasLoss(
				attempt,
				dependencies,
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

	if (!isStaleGenerating(attempt, dependencies.now())) {
		throw new ImageAnimationSettlementPendingError(attempt.id);
	}

	await failAndRefund(attempt, dependencies);
	return { reason: "stale_generation", status: "failed" };
}

async function failAndRefund(
	attempt: ImageAnimationAttempt,
	dependencies: ImageAnimationRunnerDependencies,
): Promise<void> {
	const failed = await dependencies.fail(attempt, {
		completedAt: dependencies.now(),
		error: USER_SAFE_IMAGE_ANIMATION_ERROR,
		expectedStatus: "generating",
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

	await dependencies.refund(attempt.userId, attempt.id);
}

async function settleDeletedProject(
	attempt: ImageAnimationAttempt,
	dependencies: ImageAnimationRunnerDependencies,
): Promise<ImageAnimationRunResult> {
	if (attempt.status === "succeeded") {
		// Deleting a project after a result was delivered must not grant a free
		// refund. The immutable media attempt remains the billing authority.
		return succeededResult(attempt, false);
	}

	if (attempt.status === "failed") {
		await dependencies.refund(attempt.userId, attempt.id);
		return { reason: "already_failed", status: "failed" };
	}

	const failed = await dependencies.fail(attempt, {
		completedAt: dependencies.now(),
		error: USER_SAFE_IMAGE_ANIMATION_ERROR,
		expectedStatus: attempt.status,
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

	await dependencies.refund(attempt.userId, attempt.id);
	return { reason: "project_deleted", status: "failed" };
}

async function resolveSuccessCasLoss(
	attempt: ImageAnimationAttempt,
	dependencies: ImageAnimationRunnerDependencies,
	operation: string,
): Promise<ImageAnimationRunResult> {
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
		return settleDeletedProject(current, dependencies);
	}

	if (current?.status === "failed") {
		await dependencies.refund(attempt.userId, attempt.id);
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
