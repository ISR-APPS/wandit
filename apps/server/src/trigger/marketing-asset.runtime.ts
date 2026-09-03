import { and, type createDb, eq, sql } from "@wandit/db";
import { marketingAssets } from "@wandit/db/schema/marketing-assets";
import { projects } from "@wandit/db/schema/projects";
import { env } from "@wandit/env/server";

import {
	type AnalyticsCapture,
	captureGenerationCompleted,
	captureGenerationFailed,
} from "../infrastructure/analytics/generation-events";
import {
	getObjectContentType,
	marketingAssetKey,
	putPageHtml,
} from "../infrastructure/storage/r2";
import {
	classifyAiError,
	renderAiErrorSentence,
} from "../modules/ai-errors/domain";
import { LifecycleEventsService } from "../modules/lifecycle-events/application/services/lifecycle-events.service";
import { LifecycleEventsRepository } from "../modules/lifecycle-events/infrastructure/persistence/lifecycle-events.repository";
import {
	createMarketingAssetBilling,
	type MarketingAssetBilling,
} from "../modules/marketing-assets/application/services/marketing-asset-billing";
import type {
	MarketingAssetDocument,
	MarketingAssetJob,
	MarketingAssetRunnerDependencies,
} from "../modules/marketing-assets/application/services/marketing-asset-runner";
import { generateMarketingAssetHtml } from "../modules/marketing-assets/application/services/marketing-html";
import { createTriggerMetering } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;

const ASSET_COLUMNS = {
	assetType: marketingAssets.assetType,
	brief: marketingAssets.brief,
	completedAt: marketingAssets.completedAt,
	error: marketingAssets.error,
	failureKind: marketingAssets.failureKind,
	failureProvider: marketingAssets.failureProvider,
	failureProviderMessage: marketingAssets.failureProviderMessage,
	failureRequestId: marketingAssets.failureRequestId,
	failureSource: marketingAssets.failureSource,
	id: marketingAssets.id,
	name: marketingAssets.name,
	organizationId: projects.organizationId,
	projectDeletedAt: projects.deletedAt,
	projectId: marketingAssets.projectId,
	r2Key: marketingAssets.r2Key,
	sentryEventId: marketingAssets.sentryEventId,
	startedAt: marketingAssets.startedAt,
	status: marketingAssets.status,
	triggerRunId: marketingAssets.triggerRunId,
	userId: projects.userId,
} as const;

export type MarketingAssetRuntime = {
	runner: MarketingAssetRunnerDependencies;
};

/**
 * Concrete Trigger runtime adapter. The orchestration stays in pure injected
 * functions; this file is the only place that knows about Drizzle, R2, the
 * model helper, and the existing credit/subscription services.
 */
export function createMarketingAssetRuntime(
	db: TriggerDatabase,
	analytics: AnalyticsCapture,
): MarketingAssetRuntime {
	const billing = createBilling(db);
	const persistence = createPersistence(db, analytics);

	return {
		runner: {
			capture: billing.capture,
			claimQueued: persistence.claimQueued,
			fail: persistence.failFromStatus,
			generate: async (asset, subject, signal, onProviderGeneration) => {
				const generated = await generateMarketingAssetHtml(
					{
						assetType: asset.assetType,
						brief: asset.brief,
						dateLabel: new Intl.DateTimeFormat("fr-FR", {
							dateStyle: "long",
						}).format(new Date()),
						name: asset.name,
					},
					// Metering identity comes from the queue-time subject: the acting
					// member (not the project creator) with the paying entity.
					{
						operation: "marketing",
						organizationId: subject.organizationId ?? null,
						userId: subject.actorUserId,
					},
					signal,
					onProviderGeneration,
				);

				if (generated.status !== "generated") {
					return generated;
				}

				// Deterministic key: a retry after a lost DB response finds this
				// exact object and settles without a second model call.
				const key = marketingAssetKey(asset.projectId, asset.id);

				try {
					await putPageHtml(key, generated.html);
				} catch (error) {
					const failure = classifyAiError(error, {
						model: generated.model,
						refunded: false,
						route: "none",
						surface: "marketing",
					});

					if (!failure) {
						throw new Error(
							"Marketing storage failure classification returned no result",
						);
					}

					return {
						failure,
						model: generated.model,
						...(generated.provider ? { provider: generated.provider } : {}),
						providerMetadata: generated.providerMetadata,
						message: renderAiErrorSentence(failure),
						providerUnits: 1,
						status: "failed" as const,
						...(generated.usage === undefined
							? {}
							: { usage: generated.usage }),
					};
				}

				return {
					model: generated.model,
					...(generated.provider ? { provider: generated.provider } : {}),
					providerMetadata: generated.providerMetadata,
					r2Key: key,
					status: "generated",
					...(generated.usage === undefined ? {} : { usage: generated.usage }),
				};
			},
			loadAsset: persistence.loadAsset,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredDocument: createStoredDocumentRecovery(),
			refund: billing.refund,
			reserve: billing.reserve,
			settle: billing.settle,
			settleExisting: billing.settleExisting,
		},
	};
}

function createBilling(db: TriggerDatabase): MarketingAssetBilling {
	return createMarketingAssetBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: createTriggerMetering(db),
	});
}

function createPersistence(db: TriggerDatabase, analytics: AnalyticsCapture) {
	const lifecycleEvents = new LifecycleEventsService(
		new LifecycleEventsRepository(db),
	);

	const loadAsset = async (
		assetId: string,
	): Promise<MarketingAssetJob | null> => {
		const [row] = await db
			.select(ASSET_COLUMNS)
			.from(marketingAssets)
			.innerJoin(projects, eq(projects.id, marketingAssets.projectId))
			.where(eq(marketingAssets.id, assetId))
			.limit(1);

		return row ?? null;
	};

	const claimQueued = async (
		asset: MarketingAssetJob,
		input: { runId: string; startedAt: Date },
	): Promise<MarketingAssetJob | null> => {
		const [claimed] = await db
			.update(marketingAssets)
			.set({
				error: null,
				failureKind: null,
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: null,
				sentryEventId: null,
				startedAt: input.startedAt,
				status: "generating",
				triggerRunId: input.runId,
			})
			.where(
				and(
					eq(marketingAssets.id, asset.id),
					eq(marketingAssets.projectId, asset.projectId),
					eq(marketingAssets.status, "queued"),
				),
			)
			.returning({ id: marketingAssets.id });

		return claimed ? loadAsset(claimed.id) : null;
	};

	const markSucceeded = async (
		asset: MarketingAssetJob,
		document: MarketingAssetDocument,
		completedAt: Date,
		actorUserId: string,
	): Promise<boolean> => {
		const updated = await db.transaction(async (transaction) => {
			const [succeeded] = await transaction
				.update(marketingAssets)
				.set({
					completedAt,
					error: null,
					failureKind: null,
					failureProvider: null,
					failureProviderMessage: null,
					failureRequestId: null,
					failureSource: null,
					r2Key: document.r2Key,
					sentryEventId: null,
					status: "succeeded",
				})
				.where(
					and(
						eq(marketingAssets.id, asset.id),
						eq(marketingAssets.projectId, asset.projectId),
						eq(marketingAssets.status, "generating"),
						sql`exists (
							select 1
							from ${projects}
							where ${projects.id} = ${marketingAssets.projectId}
								and ${projects.userId} = ${asset.userId}
								and ${projects.deletedAt} is null
						)`,
					),
				)
				.returning({ id: marketingAssets.id });

			if (succeeded && asset.assetType === "marketing-strategy") {
				await lifecycleEvents.enqueue(
					{
						event: "marketing_strategy_generated",
						idempotencyKey: `marketing_strategy_generated:${actorUserId}`,
						userId: actorUserId,
					},
					transaction,
				);
			}

			return succeeded;
		});

		if (updated) {
			captureGenerationCompleted(
				analytics,
				actorUserId,
				"marketing_asset",
				asset.projectId,
				asset.id,
			);
		}

		return Boolean(updated);
	};

	const failFromStatus = async (
		asset: MarketingAssetJob,
		input: {
			completedAt: Date;
			error: string;
			expectedStatus: "queued" | "generating";
			failureKind: string;
			failureProvider: string | null;
			failureProviderMessage: string | null;
			failureRequestId: string | null;
			failureSource: string;
			reason: string;
			sentryEventId: string | null;
		},
	): Promise<boolean> => {
		const [updated] = await db
			.update(marketingAssets)
			.set({
				completedAt: input.completedAt,
				error: input.error.slice(0, 2_000),
				failureKind: input.failureKind,
				failureProvider: input.failureProvider,
				failureProviderMessage: input.failureProviderMessage,
				failureRequestId: input.failureRequestId,
				failureSource: input.failureSource,
				sentryEventId: input.sentryEventId,
				status: "failed",
			})
			.where(
				and(
					eq(marketingAssets.id, asset.id),
					eq(marketingAssets.projectId, asset.projectId),
					eq(marketingAssets.status, input.expectedStatus),
				),
			)
			.returning({ id: marketingAssets.id });

		if (updated) {
			captureGenerationFailed(
				analytics,
				asset.userId,
				"marketing_asset",
				asset.projectId,
				asset.id,
				input.reason,
			);
		}

		return Boolean(updated);
	};

	return {
		claimQueued,
		failFromStatus,
		loadAsset,
		markSucceeded,
	};
}

function createStoredDocumentRecovery() {
	return async (
		asset: Pick<MarketingAssetJob, "id" | "projectId">,
	): Promise<MarketingAssetDocument | null> => {
		const key = marketingAssetKey(asset.projectId, asset.id);
		const storedMediaType = await getObjectContentType(key);

		return storedMediaType ? { r2Key: key } : null;
	};
}
