// /node, not /nestjs: this code also runs inside Trigger tasks and the worker.

import { Sentry } from "@wandit/observability/node";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";

import {
	isTerminalFixedOperationReplay,
	type MeasuredSettlementInput,
} from "../../../metering/application/services/fixed-operation-billing";
import {
	fixedGenerationStepUsage,
	type GatewayGenerationFailure,
	type GatewayGenerationMetadata,
	hasGatewayGenerationMetadata,
} from "../../../metering/domain/gateway-metering";
import type { MeteredTokenUsage } from "../../../metering/domain/model-pricing";
import type {
	MarketingAssetBilling,
	MarketingAssetReservation,
} from "./marketing-asset-billing";

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
	billingMode?: "enforce" | "off";
	/** Org workspace payer; null/absent = personal (pre-teams payloads). */
	organizationId?: string | null;
	parentEventId?: string;
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
	organizationId: string | null;
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
	| ({ status: "generated" } & MarketingAssetDocument &
			GatewayGenerationMetadata)
	| GatewayGenerationFailure
	| { message: string; status: "unavailable" };

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
		subject: MeteringSubject,
		signal?: AbortSignal,
		onProviderGeneration?: (
			generation: GatewayGenerationMetadata,
		) => Promise<void>,
	) => Promise<MarketingAssetProviderResult>;
	loadAsset: (assetId: string) => Promise<MarketingAssetJob | null>;
	markSucceeded: (
		asset: MarketingAssetJob,
		document: MarketingAssetDocument,
		completedAt: Date,
		actorUserId: string,
	) => Promise<boolean>;
	now: () => Date;
	recoverStoredDocument: (
		asset: Pick<MarketingAssetJob, "id" | "projectId">,
	) => Promise<MarketingAssetDocument | null>;
	capture: MarketingAssetBilling["capture"];
	refund: MarketingAssetBilling["refund"];
	reserve: MarketingAssetBilling["reserve"];
	settle: MarketingAssetBilling["settle"];
	settleExisting: MarketingAssetBilling["settleExisting"];
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

	const expectedKeys = [
		"assetId",
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
			"Marketing asset payload must contain only assetId, optional billingMode, optional organizationId, optional parentEventId, projectId, and userId",
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
		assetId: input.assetId,
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
 * Pure marketing-asset state machine, mirrored from the image-animation
 * runner: the database CAS is the model-call authority. Once an asset is
 * generating, every duplicate delivery and Trigger retry is recovery-only —
 * check deterministic storage, observe a terminal row, or eventually fail
 * and refund. There is deliberately no path from generating back to the
 * model.
 */
/**
 * The metering subject for this run: the queue-time ACTING member (who may
 * differ from the project creator in an org workspace) paying from the
 * project's owner entity — the org pool when org-owned. The durable row's
 * userId is the project creator and must never be used as the actor.
 */
function payloadSubject(payload: MarketingAssetPayload): MeteringSubject {
	return {
		actorUserId: payload.userId,
		...(payload.organizationId
			? { organizationId: payload.organizationId }
			: {}),
	};
}

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

	// Owner-entity assert: org assets require the same org (the acting member
	// may differ from the project creator); personal assets keep strict user
	// equality.
	if (
		!loaded ||
		loaded.projectId !== payload.projectId ||
		loaded.organizationId !== (payload.organizationId ?? null) ||
		(loaded.organizationId === null && loaded.userId !== payload.userId)
	) {
		// The payload is retained precisely so deleted/mismatched handoffs can
		// settle a prior reservation without trusting it for model inputs.
		await dependencies.refund(payloadSubject(payload), payload.assetId);

		return { reason: "ownership_mismatch", status: "failed" };
	}

	// The ownership assert above guarantees the payload and the durable row
	// agree on the paying entity; the payload adds the true acting member.
	const subject = payloadSubject(payload);

	if (loaded.status === "succeeded") {
		const reservation = await dependencies.reserve(
			subject,
			loaded.id,
			payload.parentEventId,
			payload.billingMode,
		);
		await dependencies.settle(reservation);
		return succeededResult(loaded, false);
	}

	if (loaded.projectDeletedAt !== null) {
		return settleDeletedProject(loaded, subject, dependencies);
	}

	if (loaded.status === "failed") {
		await dependencies.refund(subject, loaded.id);
		return { reason: "already_failed", status: "failed" };
	}

	if (loaded.status === "generating") {
		const recovered = await recoverStoredDocumentWithExistingSettlement(
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
			payload.parentEventId,
			payload.billingMode,
		);
		return recoverOrSettleGenerating(
			loaded,
			subject,
			dependencies,
			reservation,
		);
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
			const reservation = await dependencies.reserve(
				subject,
				raced.id,
				payload.parentEventId,
				payload.billingMode,
			);
			await dependencies.settle(reservation);
			return succeededResult(raced, false);
		}

		if (raced.projectDeletedAt !== null) {
			return settleDeletedProject(raced, subject, dependencies);
		}

		if (raced.status === "failed") {
			await dependencies.refund(subject, raced.id);
			return { reason: "already_failed", status: "failed" };
		}

		if (raced.status === "generating") {
			const recovered = await recoverStoredDocumentWithExistingSettlement(
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
				payload.parentEventId,
				payload.billingMode,
			);
			return recoverOrSettleGenerating(
				raced,
				subject,
				dependencies,
				reservation,
			);
		}

		throw new Error(
			`Marketing asset ${loaded.id} remained queued after its claim race`,
		);
	}

	if (claimed.projectDeletedAt !== null) {
		return settleDeletedProject(claimed, subject, dependencies);
	}

	let reservation: MarketingAssetReservation;

	try {
		reservation = await dependencies.reserve(
			subject,
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
				tags: { assetId: claimed.id, userId: claimed.userId },
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

	let generated: MarketingAssetProviderResult;
	let generationCapturedBeforeDelivery = false;

	try {
		generated = await dependencies.generate(
			claimed,
			subject,
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
				tags: { assetId: claimed.id, userId: claimed.userId },
			});
		}
		await failAndRefund(claimed, subject, dependencies, "generation_failed");
		return { reason: "generation_failed", status: "failed" };
	}

	if (generated.status !== "generated") {
		// The provider's message is about to be replaced by a generic
		// "generation_failed" — keep the original reason.
		Sentry.captureMessage(`Marketing asset failed: ${generated.message}`, {
			level: "error",
			tags: { assetId: claimed.id, userId: claimed.userId },
		});
		const providerUnits =
			"providerUnits" in generated && generated.providerUnits === 1 ? 1 : 0;
		if (hasGatewayGenerationMetadata(generated)) {
			if (!generationCapturedBeforeDelivery) {
				await dependencies.capture(reservation, {
					providerMetadata: generated.providerMetadata,
					// A zero-unit provider failure is refunded to the user; the marker
					// keeps its gateway cost out of the customer charge.
					stepUsage: fixedGenerationStepUsage(
						generated.usage,
						providerUnits,
						providerUnits === 0 ? "refunded_failure" : undefined,
					),
				});
			}
			await dependencies.settle(reservation, {
				completedUnits: providerUnits,
				tokenUsage: marketingTokenUsage(generated),
			});
		}
		await failAndRefund(
			claimed,
			subject,
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
				tags: { assetId: claimed.id, userId: claimed.userId },
			});
			await failAndRefund(
				claimed,
				subject,
				dependencies,
				"generation_capture_failed",
				false,
			);
			return { reason: "generation_failed", status: "failed" };
		}
	}

	// A succeeded asset is user-visible, so settle before publishing that state.
	await dependencies.settle(reservation, {
		completedUnits: 1,
		tokenUsage: marketingTokenUsage(generated),
	});

	const persisted = await dependencies.markSucceeded(
		claimed,
		generated,
		dependencies.now(),
		subject.actorUserId,
	);

	if (!persisted) {
		return resolveSuccessCasLoss(
			claimed,
			subject,
			dependencies,
			reservation,
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
	subject: MeteringSubject,
	dependencies: MarketingAssetRunnerDependencies,
	reservation: MarketingAssetReservation,
): Promise<MarketingAssetRunResult> {
	const recovered = await dependencies.recoverStoredDocument(asset);

	if (recovered) {
		if (!isTerminalFixedOperationReplay(reservation)) {
			await dependencies.settle(reservation);
		}

		const persisted = await dependencies.markSucceeded(
			asset,
			recovered,
			dependencies.now(),
			subject.actorUserId,
		);

		if (!persisted) {
			return resolveSuccessCasLoss(
				asset,
				subject,
				dependencies,
				reservation,
				"stored-document recovery",
			);
		}

		return {
			r2Key: recovered.r2Key,
			recovered: true,
			status: "succeeded",
		};
	}

	if (isTerminalFixedOperationReplay(reservation)) {
		await failAndRefund(
			asset,
			subject,
			dependencies,
			"terminal_billing",
			false,
		);
		return { reason: "generation_failed", status: "failed" };
	}

	if (!isStaleGenerating(asset, dependencies.now())) {
		throw new MarketingAssetSettlementPendingError(asset.id);
	}

	await failAndRefund(asset, subject, dependencies, "stale_generation");
	return { reason: "stale_generation", status: "failed" };
}

async function recoverStoredDocumentWithExistingSettlement(
	asset: MarketingAssetJob,
	subject: MeteringSubject,
	dependencies: MarketingAssetRunnerDependencies,
	billingMode: MarketingAssetPayload["billingMode"],
): Promise<MarketingAssetRunResult | null> {
	const recovered = await dependencies.recoverStoredDocument(asset);

	if (!recovered) {
		return null;
	}

	const settled = await dependencies.settleExisting(subject, asset.id);
	if (!settled && billingMode === "enforce") {
		throw new Error(
			`Marketing asset ${asset.id} has stored output but no enforced metering event`,
		);
	}
	const persisted = await dependencies.markSucceeded(
		asset,
		recovered,
		dependencies.now(),
		subject.actorUserId,
	);

	if (!persisted) {
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
			return settleDeletedProject(current, subject, dependencies, false);
		}
		if (current?.status === "failed") {
			return { reason: "already_failed", status: "failed" };
		}
		throw new Error(
			`Marketing asset ${asset.id} lost its stored-document completion state`,
		);
	}

	return { r2Key: recovered.r2Key, recovered: true, status: "succeeded" };
}

async function failAndRefund(
	asset: MarketingAssetJob,
	subject: MeteringSubject,
	dependencies: MarketingAssetRunnerDependencies,
	reason: string,
	shouldRefund = true,
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

	if (shouldRefund) {
		await dependencies.refund(subject, asset.id);
	}
}

async function settleDeletedProject(
	asset: MarketingAssetJob,
	subject: MeteringSubject,
	dependencies: MarketingAssetRunnerDependencies,
	shouldRefund = true,
): Promise<MarketingAssetRunResult> {
	if (asset.status === "succeeded") {
		// Deleting a project after a result was delivered must not grant a free
		// refund. The immutable asset row remains the billing authority.
		return succeededResult(asset, false);
	}

	if (asset.status === "failed") {
		if (shouldRefund) {
			await dependencies.refund(subject, asset.id);
		}
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

	if (shouldRefund) {
		await dependencies.refund(subject, asset.id);
	}
	return { reason: "project_deleted", status: "failed" };
}

async function resolveSuccessCasLoss(
	asset: MarketingAssetJob,
	subject: MeteringSubject,
	dependencies: MarketingAssetRunnerDependencies,
	reservation: MarketingAssetReservation,
	operation: string,
): Promise<MarketingAssetRunResult> {
	const current = await dependencies.loadAsset(asset.id);

	if (current?.status === "succeeded") {
		await dependencies.settle(reservation);
		return succeededResult(current, true);
	}

	if (
		current &&
		current.projectId === asset.projectId &&
		current.userId === asset.userId &&
		current.projectDeletedAt !== null
	) {
		return settleDeletedProject(current, subject, dependencies, false);
	}

	if (current?.status === "failed") {
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

/** Token settlement input from the provider evidence, when usage is known. */
function marketingTokenUsage(
	generated: Partial<GatewayGenerationMetadata>,
): NonNullable<MeasuredSettlementInput["tokenUsage"]> | null {
	if (!generated.model || !isTokenUsage(generated.usage)) {
		return null;
	}

	return {
		modelId: generated.model,
		provider: generated.provider ?? null,
		rawUsage: generated.usage,
		usage: generated.usage,
	};
}

function isTokenUsage(value: unknown): value is MeteredTokenUsage {
	return (
		typeof value === "object" &&
		value !== null &&
		("inputTokens" in value || "outputTokens" in value)
	);
}
