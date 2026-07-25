import type { ImageGenerationAspect } from "@wandit/contracts";

export const USER_SAFE_IMAGE_GENERATION_ERROR =
	"We couldn't generate these images. Please try again in a moment.";

// One image call is much faster than a video, but an attempt can hold up to
// four sequential calls; the stale window covers the worst case plus grace.
export const IMAGE_GENERATION_PROVIDER_TIMEOUT_MS = 2 * 60_000;
export const IMAGE_GENERATION_RECOVERY_GRACE_MS = 2 * 60_000;
export const IMAGE_GENERATION_STALE_GENERATING_MS =
	4 * IMAGE_GENERATION_PROVIDER_TIMEOUT_MS + IMAGE_GENERATION_RECOVERY_GRACE_MS;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ImageGenerationPayload = {
	attemptId: string;
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
	projectDeletedAt: Date | null;
	projectId: string;
	prompt: string;
	sourceImageUrls: string[];
	startedAt: Date | null;
	status: ImageGenerationAttemptStatus;
	title: string;
	triggerRunId: string | null;
	userId: string;
};

export type GeneratedImageResult = {
	mediaType: string;
	url: string;
};

export type ImageGenerationProviderResult =
	| ({ status: "generated" } & GeneratedImageResult)
	| { message: string; status: "failed" | "unavailable" };

export type ImageGenerationRunnerDependencies = {
	claimQueued: (
		attempt: ImageGenerationAttemptState,
		input: { runId: string; startedAt: Date },
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
		},
	) => Promise<boolean>;
	generateOne: (
		attempt: ImageGenerationAttemptState,
		index: number,
		signal?: AbortSignal,
	) => Promise<ImageGenerationProviderResult>;
	loadAttempt: (
		attemptId: string,
	) => Promise<ImageGenerationAttemptState | null>;
	markSucceeded: (
		attempt: ImageGenerationAttemptState,
		images: GeneratedImageResult[],
		completedAt: Date,
	) => Promise<boolean>;
	now: () => Date;
	recoverStoredImages: (
		attempt: Pick<ImageGenerationAttemptState, "count" | "id" | "projectId">,
	) => Promise<GeneratedImageResult[] | null>;
	refund: (userId: string, attemptId: string) => Promise<void>;
	reserve: (userId: string, attemptId: string) => Promise<void>;
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

	if (
		keys.length !== 3 ||
		keys[0] !== "attemptId" ||
		keys[1] !== "projectId" ||
		keys[2] !== "userId"
	) {
		throw new TypeError(
			"Image generation payload must contain only attemptId, projectId, and userId",
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
 * Pure image-generation state machine — same shape as image animation: the
 * database CAS is the provider-call authority; once an attempt is generating,
 * every duplicate delivery and Trigger retry is recovery-only. The provider
 * loop is all-or-nothing: an attempt succeeds only when EVERY requested image
 * uploaded, otherwise it fails once and refunds once.
 */
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

	if (
		!loaded ||
		loaded.projectId !== payload.projectId ||
		loaded.userId !== payload.userId
	) {
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
				`Image generation ${loaded.id} disappeared after its claim race`,
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
			`Image generation ${loaded.id} remained queued after its claim race`,
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

	const images: GeneratedImageResult[] = [];

	for (let index = 1; index <= claimed.count; index += 1) {
		let generated: ImageGenerationProviderResult;

		try {
			generated = await dependencies.generateOne(claimed, index, input.signal);
		} catch {
			await failAndRefund(claimed, dependencies);
			return { reason: "generation_failed", status: "failed" };
		}

		if (generated.status !== "generated") {
			await failAndRefund(claimed, dependencies);
			return { reason: "generation_failed", status: "failed" };
		}

		images.push({ mediaType: generated.mediaType, url: generated.url });
	}

	const persisted = await dependencies.markSucceeded(
		claimed,
		images,
		dependencies.now(),
	);

	if (!persisted) {
		return resolveSuccessCasLoss(
			claimed,
			dependencies,
			"direct generation completion",
		);
	}

	return { images, recovered: false, status: "succeeded" };
}

async function recoverOrSettleGenerating(
	attempt: ImageGenerationAttemptState,
	dependencies: ImageGenerationRunnerDependencies,
): Promise<ImageGenerationRunResult> {
	const recovered = await dependencies.recoverStoredImages(attempt);

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
				"stored-image recovery",
			);
		}

		return { images: recovered, recovered: true, status: "succeeded" };
	}

	if (!isStaleGenerating(attempt, dependencies.now())) {
		throw new ImageGenerationSettlementPendingError(attempt.id);
	}

	await failAndRefund(attempt, dependencies);
	return { reason: "stale_generation", status: "failed" };
}

async function failAndRefund(
	attempt: ImageGenerationAttemptState,
	dependencies: ImageGenerationRunnerDependencies,
): Promise<void> {
	const failed = await dependencies.fail(attempt, {
		completedAt: dependencies.now(),
		error: USER_SAFE_IMAGE_GENERATION_ERROR,
		expectedStatus: "generating",
	});

	if (!failed) {
		const current = await dependencies.loadAttempt(attempt.id);

		if (current?.status === "succeeded") {
			return;
		}

		if (current?.status !== "failed") {
			throw new Error(
				`Image generation ${attempt.id} could not persist its failure`,
			);
		}
	}

	await dependencies.refund(attempt.userId, attempt.id);
}

async function settleDeletedProject(
	attempt: ImageGenerationAttemptState,
	dependencies: ImageGenerationRunnerDependencies,
): Promise<ImageGenerationRunResult> {
	if (attempt.status === "succeeded") {
		// Deleting a project after delivery must not grant a free refund.
		return succeededResult(attempt, false);
	}

	if (attempt.status === "failed") {
		await dependencies.refund(attempt.userId, attempt.id);
		return { reason: "already_failed", status: "failed" };
	}

	const failed = await dependencies.fail(attempt, {
		completedAt: dependencies.now(),
		error: USER_SAFE_IMAGE_GENERATION_ERROR,
		expectedStatus: attempt.status,
	});

	if (!failed) {
		const current = await dependencies.loadAttempt(attempt.id);

		if (current?.status === "succeeded") {
			return succeededResult(current, false);
		}

		if (current?.status !== "failed") {
			throw new Error(
				`Deleted-project image generation ${attempt.id} could not settle`,
			);
		}
	}

	await dependencies.refund(attempt.userId, attempt.id);
	return { reason: "project_deleted", status: "failed" };
}

async function resolveSuccessCasLoss(
	attempt: ImageGenerationAttemptState,
	dependencies: ImageGenerationRunnerDependencies,
	operation: string,
): Promise<ImageGenerationRunResult> {
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
		`Image generation ${attempt.id} lost its ${operation} state transition`,
	);
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

function succeededResult(
	attempt: Pick<ImageGenerationAttemptState, "id" | "images">,
	recovered: boolean,
): ImageGenerationRunResult {
	if (!attempt.images || attempt.images.length === 0) {
		throw new Error(
			`Succeeded image generation ${attempt.id} has no persisted images`,
		);
	}

	return { images: attempt.images, recovered, status: "succeeded" };
}
