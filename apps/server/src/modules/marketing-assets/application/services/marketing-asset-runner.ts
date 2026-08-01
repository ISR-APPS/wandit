// /node, not /nestjs: this code also runs inside Trigger tasks and the worker.
import { Sentry } from "@wandit/observability/node";

export const USER_SAFE_MARKETING_ASSET_ERROR =
	"We couldn't generate this marketing asset. Please try again in a moment.";

export const MARKETING_ASSET_PROVIDER_TIMEOUT_MS = 5 * 60_000;
export const MARKETING_ASSET_RECOVERY_GRACE_MS = 2 * 60_000;
export const MARKETING_ASSET_STALE_GENERATING_MS =
	MARKETING_ASSET_PROVIDER_TIMEOUT_MS + MARKETING_ASSET_RECOVERY_GRACE_MS;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MarketingAssetPayload = {
	assetId: string;
	projectId: string;
	userId: string;
};

export type MarketingAssetJobStatus =
	| "queued"
	| "generating"
	| "succeeded"
	| "failed";

export type MarketingAssetJob = {
	assetType:
		| "ad-copy"
		| "marketing-strategy"
		| "video-script"
		| "creative-brief"
		| "html-asset";
	brief: string;
	completedAt: Date | null;
	error: string | null;
	id: string;
	name: string;
	projectDeletedAt: Date | null;
	projectId: string;
	r2Key: string | null;
	startedAt: Date | null;
	status: MarketingAssetJobStatus;
	triggerRunId: string | null;
	userId: string;
};

export type MarketingAssetDocument = {
	r2Key: string;
};

export type MarketingAssetProviderResult =
	| ({ status: "generated" } & MarketingAssetDocument)
	| { message: string; status: "failed" | "unavailable" };

export type MarketingAssetRunnerDependencies = {
	claimQueued: (
		asset: MarketingAssetJob,
		input: { runId: string; startedAt: Date },
	) => Promise<MarketingAssetJob | null>;
	fail: (
		asset: MarketingAssetJob,
		input: {
			completedAt: Date;
			error: string;
			expectedStatus: Extract<MarketingAssetJobStatus, "queued" | "generating">;
			reason: string;
		},
	) => Promise<boolean>;
	generate: (
		asset: MarketingAssetJob,
		signal?: AbortSignal,
	) => Promise<MarketingAssetProviderResult>;
	loadAsset: (assetId: string) => Promise<MarketingAssetJob | null>;
	markSucceeded: (
		asset: MarketingAssetJob,
		document: MarketingAssetDocument,
		completedAt: Date,
	) => Promise<boolean>;
	now: () => Date;
	recoverStoredDocument: (
		asset: Pick<MarketingAssetJob, "id" | "projectId">,
	) => Promise<MarketingAssetDocument | null>;
	refund: (userId: string, assetId: string) => Promise<void>;
	reserve: (userId: string, assetId: string) => Promise<void>;
};

export type MarketingAssetRunResult =
	| {
			r2Key: string;
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
 * row is observed without its deterministic R2 object; retrying may settle
 * the upload/DB ambiguity, but can never invoke the model again because only
 * the queued -> generating claim path reaches it.
 */
export class MarketingAssetSettlementPendingError extends Error {
	constructor(assetId: string) {
		super(`Marketing asset ${assetId} is awaiting durable settlement`);
		this.name = "MarketingAssetSettlementPendingError";
	}
}

/**
 * Validate the only payload shape accepted by the Trigger task. A custom
 * parser keeps schemaTask runtime validation without adding an undeclared
 * schema-library dependency to the server package.
 */
export function parseMarketingAssetPayload(
	value: unknown,
): MarketingAssetPayload {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError("Marketing asset payload must be an object");
	}

	const input = value as Record<string, unknown>;
	const keys = Object.keys(input).sort();

	if (
		keys.length !== 3 ||
		keys[0] !== "assetId" ||
		keys[1] !== "projectId" ||
		keys[2] !== "userId"
	) {
		throw new TypeError(
			"Marketing asset payload must contain only assetId, projectId, and userId",
		);
	}

	if (typeof input.assetId !== "string" || !UUID_PATTERN.test(input.assetId)) {
		throw new TypeError("assetId must be a UUID");
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
		assetId: input.assetId,
		projectId: input.projectId,
		userId: input.userId,
	};
}

/**
 * Pure marketing-asset state machine, mirrored from the image-animation
 * runner: the database CAS is the model-call authority. Once an asset is
 * generating, every duplicate delivery and Trigger retry is recovery-only —
 * check deterministic storage, observe a terminal row, or eventually fail
 * and refund. There is deliberately no path from generating back to the
 * model.
 */
export async function runMarketingAssetGeneration(
	payload: MarketingAssetPayload,
	input: {
		dependencies: MarketingAssetRunnerDependencies;
		runId: string;
		signal?: AbortSignal;
	},
): Promise<MarketingAssetRunResult> {
	const { dependencies } = input;
	const loaded = await dependencies.loadAsset(payload.assetId);

	if (
		!loaded ||
		loaded.projectId !== payload.projectId ||
		loaded.userId !== payload.userId
	) {
		// The payload is retained precisely so deleted/mismatched handoffs can
		// settle a prior reservation without trusting it for model inputs.
		await dependencies.refund(payload.userId, payload.assetId);

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
		// branch must never fall through to the model.
		const raced = await dependencies.loadAsset(loaded.id);

		if (!raced) {
			throw new Error(
				`Marketing asset ${loaded.id} disappeared after its claim race`,
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
			`Marketing asset ${loaded.id} remained queued after its claim race`,
		);
	}

	if (claimed.projectDeletedAt !== null) {
		return settleDeletedProject(claimed, dependencies);
	}

	try {
		await dependencies.reserve(claimed.userId, claimed.id);
	} catch (error) {
		// Insufficient credits is an expected outcome; anything else here is
		// billing/DB infrastructure failing and must be visible.
		if (
			!(error instanceof Error && error.name === "InsufficientCreditsError")
		) {
			Sentry.captureException(error, {
				tags: { assetId: claimed.id, userId: claimed.userId },
			});
		}
		await failAndRefund(claimed, dependencies, "reservation_failed");
		return { reason: "reservation_failed", status: "failed" };
	}

	let generated: MarketingAssetProviderResult;

	try {
		generated = await dependencies.generate(claimed, input.signal);
	} catch (error) {
		// User aborts are expected; anything else was previously invisible.
		if (!input.signal?.aborted) {
			Sentry.captureException(error, {
				tags: { assetId: claimed.id, userId: claimed.userId },
			});
		}
		await failAndRefund(claimed, dependencies, "generation_failed");
		return { reason: "generation_failed", status: "failed" };
	}

	if (generated.status !== "generated") {
		// The provider's message is about to be replaced by a generic
		// "generation_failed" — keep the original reason.
		Sentry.captureMessage(`Marketing asset failed: ${generated.message}`, {
			level: "error",
			tags: { assetId: claimed.id, userId: claimed.userId },
		});
		await failAndRefund(claimed, dependencies, "generation_failed");
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
		r2Key: generated.r2Key,
		recovered: false,
		status: "succeeded",
	};
}

async function recoverOrSettleGenerating(
	asset: MarketingAssetJob,
	dependencies: MarketingAssetRunnerDependencies,
): Promise<MarketingAssetRunResult> {
	const recovered = await dependencies.recoverStoredDocument(asset);

	if (recovered) {
		const persisted = await dependencies.markSucceeded(
			asset,
			recovered,
			dependencies.now(),
		);

		if (!persisted) {
			return resolveSuccessCasLoss(
				asset,
				dependencies,
				"stored-document recovery",
			);
		}

		return {
			r2Key: recovered.r2Key,
			recovered: true,
			status: "succeeded",
		};
	}

	if (!isStaleGenerating(asset, dependencies.now())) {
		throw new MarketingAssetSettlementPendingError(asset.id);
	}

	await failAndRefund(asset, dependencies, "stale_generation");
	return { reason: "stale_generation", status: "failed" };
}

async function failAndRefund(
	asset: MarketingAssetJob,
	dependencies: MarketingAssetRunnerDependencies,
	reason: string,
): Promise<void> {
	const failed = await dependencies.fail(asset, {
		completedAt: dependencies.now(),
		error: USER_SAFE_MARKETING_ASSET_ERROR,
		expectedStatus: "generating",
		reason,
	});

	if (!failed) {
		const current = await dependencies.loadAsset(asset.id);

		if (current?.status === "succeeded") {
			return;
		}

		if (current?.status !== "failed") {
			throw new Error(
				`Marketing asset ${asset.id} could not persist its failure`,
			);
		}
	}

	await dependencies.refund(asset.userId, asset.id);
}

async function settleDeletedProject(
	asset: MarketingAssetJob,
	dependencies: MarketingAssetRunnerDependencies,
): Promise<MarketingAssetRunResult> {
	if (asset.status === "succeeded") {
		// Deleting a project after a result was delivered must not grant a free
		// refund. The immutable asset row remains the billing authority.
		return succeededResult(asset, false);
	}

	if (asset.status === "failed") {
		await dependencies.refund(asset.userId, asset.id);
		return { reason: "already_failed", status: "failed" };
	}

	const failed = await dependencies.fail(asset, {
		completedAt: dependencies.now(),
		error: USER_SAFE_MARKETING_ASSET_ERROR,
		expectedStatus: asset.status,
		reason: "project_deleted",
	});

	if (!failed) {
		const current = await dependencies.loadAsset(asset.id);

		if (current?.status === "succeeded") {
			return succeededResult(current, false);
		}

		if (current?.status !== "failed") {
			throw new Error(
				`Deleted-project marketing asset ${asset.id} could not settle`,
			);
		}
	}

	await dependencies.refund(asset.userId, asset.id);
	return { reason: "project_deleted", status: "failed" };
}

async function resolveSuccessCasLoss(
	asset: MarketingAssetJob,
	dependencies: MarketingAssetRunnerDependencies,
	operation: string,
): Promise<MarketingAssetRunResult> {
	const current = await dependencies.loadAsset(asset.id);

	if (current?.status === "succeeded") {
		return succeededResult(current, true);
	}

	if (
		current &&
		current.projectId === asset.projectId &&
		current.userId === asset.userId &&
		current.projectDeletedAt !== null
	) {
		return settleDeletedProject(current, dependencies);
	}

	if (current?.status === "failed") {
		await dependencies.refund(asset.userId, asset.id);
		return { reason: "already_failed", status: "failed" };
	}

	throw new Error(
		`Marketing asset ${asset.id} lost its ${operation} state transition`,
	);
}

function isStaleGenerating(
	asset: Pick<MarketingAssetJob, "startedAt">,
	now: Date,
): boolean {
	return (
		asset.startedAt !== null &&
		now.getTime() - asset.startedAt.getTime() >=
			MARKETING_ASSET_STALE_GENERATING_MS
	);
}

function succeededResult(
	asset: Pick<MarketingAssetJob, "id" | "r2Key">,
	recovered: boolean,
): MarketingAssetRunResult {
	if (!asset.r2Key) {
		throw new Error(
			`Succeeded marketing asset ${asset.id} has no persisted document`,
		);
	}

	return {
		r2Key: asset.r2Key,
		recovered,
		status: "succeeded",
	};
}
