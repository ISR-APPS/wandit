import { ENTITLED_SUBSCRIPTION_STATUSES } from "@wandit/contracts";
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
import { SubscriptionsRepository } from "../modules/billing/infrastructure/persistence/subscriptions.repository";
import { CreditsService } from "../modules/credits/application/services/credits.service";
import { CreditsRepository } from "../modules/credits/infrastructure/persistence/credits.repository";
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

type TriggerDatabase = ReturnType<typeof createDb>;

const ASSET_COLUMNS = {
	assetType: marketingAssets.assetType,
	brief: marketingAssets.brief,
	completedAt: marketingAssets.completedAt,
	error: marketingAssets.error,
	id: marketingAssets.id,
	name: marketingAssets.name,
	projectDeletedAt: projects.deletedAt,
	projectId: marketingAssets.projectId,
	r2Key: marketingAssets.r2Key,
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
			claimQueued: persistence.claimQueued,
			fail: persistence.failFromStatus,
			generate: async (asset, signal) => {
				const generated = await generateMarketingAssetHtml(
					{
						assetType: asset.assetType,
						brief: asset.brief,
						dateLabel: new Intl.DateTimeFormat("fr-FR", {
							dateStyle: "long",
						}).format(new Date()),
						name: asset.name,
					},
					signal,
				);

				if (generated.status !== "generated") {
					return generated;
				}

				// Deterministic key: a retry after a lost DB response finds this
				// exact object and settles without a second model call.
				const key = marketingAssetKey(asset.projectId, asset.id);

				await putPageHtml(key, generated.html);

				return { r2Key: key, status: "generated" };
			},
			loadAsset: persistence.loadAsset,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredDocument: createStoredDocumentRecovery(),
			refund: billing.refund,
			reserve: billing.reserve,
		},
	};
}

function createBilling(db: TriggerDatabase): MarketingAssetBilling {
	const creditsService = new CreditsService(new CreditsRepository(db));
	const subscriptionsRepository = new SubscriptionsRepository(db);

	return createMarketingAssetBilling({
		consumeCredits: (userId, amount, options) =>
			creditsService.consume(userId, amount, options),
		hasActiveSubscription: async (userId) => {
			const subscription =
				await subscriptionsRepository.findActiveByUserId(userId);

			return (
				subscription !== null &&
				(ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
					subscription.status,
				)
			);
		},
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		refundCredits: (userId, consumeIdempotencyKey, meta) =>
			creditsService.refundConsume(userId, consumeIdempotencyKey, meta),
	});
}

function createPersistence(db: TriggerDatabase, analytics: AnalyticsCapture) {
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
	): Promise<boolean> => {
		const [updated] = await db
			.update(marketingAssets)
			.set({
				completedAt,
				error: null,
				r2Key: document.r2Key,
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

		if (updated) {
			captureGenerationCompleted(
				analytics,
				asset.userId,
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
			reason: string;
		},
	): Promise<boolean> => {
		const [updated] = await db
			.update(marketingAssets)
			.set({
				completedAt: input.completedAt,
				error: input.error.slice(0, 2_000),
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
