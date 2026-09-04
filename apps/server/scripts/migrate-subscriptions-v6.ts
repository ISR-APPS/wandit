import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
	type BillingPlanId,
	type CreditTier,
	ENTITLED_SUBSCRIPTION_STATUSES,
	isKnownTier,
	isPurchasableTier,
	LEGACY_CREDIT_TIERS,
	priceLookupKey,
	purchasableTierForLegacy,
} from "@wandit/contracts";
import { and, asc, createDb, eq, inArray } from "@wandit/db";
import { subscriptions } from "@wandit/db/schema/billing";
import { BillingChangeIntentsRepository } from "../src/modules/billing/infrastructure/persistence/billing-change-intents.repository";
import { SubscriptionsRepository } from "../src/modules/billing/infrastructure/persistence/subscriptions.repository";
import { STRIPE_API_VERSION } from "../src/modules/billing/infrastructure/stripe/stripe.constants";
import { StripeProvider } from "../src/modules/billing/infrastructure/stripe/stripe.provider";
import {
	orgOwner,
	userOwner,
} from "../src/modules/credits/domain/credit-owner";

type SubscriptionRow = typeof subscriptions.$inferSelect;
const MIGRATION_INTENT_SENTINEL = "00000000-0000-4000-8000-000000000000";

export type V6MigrationSubscription = Pick<
	SubscriptionRow,
	| "cancelAtPeriodEnd"
	| "currentPeriodEnd"
	| "id"
	| "interval"
	| "organizationId"
	| "pendingAppliedBy"
	| "pendingTierCredits"
	| "plan"
	| "priceLookupKey"
	| "provider"
	| "providerSubscriptionId"
	| "status"
	| "tierCredits"
	| "userId"
>;

export type V6MigrationDependencies = {
	markPendingTierApplied(
		providerSubscriptionId: string,
		appliedBy: string,
	): Promise<unknown>;
	reloadSubscription(
		subscriptionId: string,
	): Promise<V6MigrationSubscription | null>;
	scheduleSubscriptionDowngrade(input: {
		allowSameIntentRecovery?: boolean;
		currentPriceLookupKey: string;
		expectedScheduleTarget: string | null;
		idempotencyKey: string;
		newPriceLookupKey: string;
		providerSubscriptionId: string;
	}): Promise<string>;
	setPendingTierCredits(
		providerSubscriptionId: string,
		pendingTierCredits: CreditTier,
	): Promise<unknown>;
	switchSubscriptionPriceWithoutProration(input: {
		currentPriceLookupKey: string;
		idempotencyKey: string;
		newPriceLookupKey: string;
		providerSubscriptionId: string;
	}): Promise<void>;
	updateLocalTier(
		subscriptionId: string,
		tierCredits: CreditTier,
		lookupKey: string,
	): Promise<void>;
	withOwnerLock(
		subscription: V6MigrationSubscription,
		operation: () => Promise<V6MigrationSummaryRow>,
	): Promise<V6MigrationSummaryRow | null>;
};

export type V6MigrationSummaryRow = {
	effectiveDate: string;
	id: string;
	interval: "month" | "year";
	newTier: number;
	oldTier: number;
	ownerType: "organization" | "user";
	plan: BillingPlanId;
	provider: string;
	reason: string;
	status: "applied" | "failed" | "skipped";
};

export function migrationExitCode(
	summary: readonly V6MigrationSummaryRow[],
): 0 | 1 {
	return summary.some((row) => row.status === "failed") ? 1 : 0;
}

export async function migrateSubscriptionV6(
	subscription: V6MigrationSubscription,
	apply: boolean,
	dependencies: V6MigrationDependencies,
): Promise<V6MigrationSummaryRow> {
	if (!apply) {
		return migrateSubscriptionV6Unlocked(subscription, false, dependencies);
	}

	try {
		const result = await dependencies.withOwnerLock(subscription, () =>
			migrateSubscriptionV6Unlocked(subscription, true, dependencies),
		);

		return (
			result ??
			summaryRow(
				subscription,
				purchasableTierForLegacy(subscription.plan, subscription.tierCredits) ??
					subscription.tierCredits,
				"skipped",
				"row changed since candidates were read",
			)
		);
	} catch (error) {
		return summaryRow(
			subscription,
			purchasableTierForLegacy(subscription.plan, subscription.tierCredits) ??
				subscription.tierCredits,
			"failed",
			errorMessage(error),
		);
	}
}

async function migrateSubscriptionV6Unlocked(
	subscription: V6MigrationSubscription,
	apply: boolean,
	dependencies: V6MigrationDependencies,
): Promise<V6MigrationSummaryRow> {
	const mappedCurrentTier = purchasableTierForLegacy(
		subscription.plan,
		subscription.tierCredits,
	);

	if (
		mappedCurrentTier === null ||
		subscription.plan === "starter" ||
		(subscription.provider !== "stripe" && subscription.provider !== "manual")
	) {
		return summaryRow(
			subscription,
			subscription.tierCredits,
			"skipped",
			"not a migratable legacy subscription",
		);
	}

	let intendedTier = mappedCurrentTier;

	try {
		if (subscription.interval === "month") {
			if (subscription.pendingTierCredits !== null) {
				return summaryRow(
					subscription,
					mappedCurrentTier,
					"skipped",
					`existing pending change to ${subscription.pendingTierCredits} credits requires operator review`,
				);
			}

			const targetLookupKey = priceLookupKey(
				subscription.plan,
				mappedCurrentTier,
				"month",
			);

			if (apply) {
				if (!(await snapshotIsCurrent(subscription, dependencies))) {
					return summaryRow(
						subscription,
						mappedCurrentTier,
						"skipped",
						"row changed since candidates were read",
					);
				}

				if (subscription.provider === "stripe") {
					await dependencies.switchSubscriptionPriceWithoutProration({
						currentPriceLookupKey: subscription.priceLookupKey,
						idempotencyKey: `billing-migrate-v6:month:${subscription.providerSubscriptionId}:${targetLookupKey}`,
						newPriceLookupKey: targetLookupKey,
						providerSubscriptionId: subscription.providerSubscriptionId,
					});
				}

				await dependencies.updateLocalTier(
					subscription.id,
					mappedCurrentTier,
					targetLookupKey,
				);
			}

			return summaryRow(
				subscription,
				mappedCurrentTier,
				apply ? "applied" : "skipped",
				apply
					? subscription.provider === "stripe"
						? "Stripe price and local tier switched without proration"
						: "manual local tier switched for the next renewal"
					: "dry run: monthly tier would be switched",
			);
		}

		if (subscription.provider === "stripe" && subscription.cancelAtPeriodEnd) {
			return summaryRow(
				subscription,
				mappedCurrentTier,
				"skipped",
				"yearly subscription is set to cancel at period end; rerun after a resume",
			);
		}

		const pendingTarget = resolveYearlyTarget(subscription, mappedCurrentTier);

		if (pendingTarget.status === "skipped") {
			return summaryRow(
				subscription,
				pendingTarget.tierCredits,
				"skipped",
				pendingTarget.reason,
			);
		}
		intendedTier = pendingTarget.tierCredits;

		const targetLookupKey = priceLookupKey(
			subscription.plan,
			pendingTarget.tierCredits,
			"year",
		);

		if (apply) {
			if (!(await snapshotIsCurrent(subscription, dependencies))) {
				return summaryRow(
					subscription,
					pendingTarget.tierCredits,
					"skipped",
					"row changed since candidates were read",
				);
			}

			if (subscription.provider === "stripe") {
				const scheduleId = await dependencies.scheduleSubscriptionDowngrade({
					allowSameIntentRecovery: true,
					currentPriceLookupKey: subscription.priceLookupKey,
					expectedScheduleTarget: expectedScheduleTargetFor(subscription),
					idempotencyKey: `billing-migrate-v6:year:${subscription.providerSubscriptionId}:${targetLookupKey}`,
					newPriceLookupKey: targetLookupKey,
					providerSubscriptionId: subscription.providerSubscriptionId,
				});
				const pending = await dependencies.setPendingTierCredits(
					subscription.providerSubscriptionId,
					pendingTarget.tierCredits,
				);

				if (!pending) {
					throw new Error(
						`Local subscription ${subscription.id} disappeared after Stripe scheduled its v6 tier`,
					);
				}

				const marked = await dependencies.markPendingTierApplied(
					subscription.providerSubscriptionId,
					scheduleId,
				);

				if (!marked) {
					throw new Error(
						`Local subscription ${subscription.id} could not record Stripe schedule ${scheduleId}`,
					);
				}
			} else {
				const pending = await dependencies.setPendingTierCredits(
					subscription.providerSubscriptionId,
					pendingTarget.tierCredits,
				);

				if (!pending) {
					throw new Error(
						`Manual subscription ${subscription.id} disappeared while scheduling its v6 renewal tier`,
					);
				}
			}
		}

		return summaryRow(
			subscription,
			pendingTarget.tierCredits,
			apply ? "applied" : "skipped",
			apply
				? pendingTarget.retargeted
					? "existing legacy renewal change retargeted to its v6 tier"
					: "v6 tier scheduled for the yearly renewal"
				: pendingTarget.retargeted
					? "dry run: legacy renewal change would be retargeted"
					: "dry run: v6 tier would be scheduled for yearly renewal",
		);
	} catch (error) {
		return summaryRow(
			subscription,
			intendedTier,
			"failed",
			errorMessage(error),
		);
	}
}

function expectedScheduleTargetFor(
	subscription: V6MigrationSubscription,
): string | null {
	if (subscription.pendingTierCredits === null) {
		return null;
	}

	if (!isKnownTier(subscription.pendingTierCredits)) {
		throw new Error(
			`Local subscription ${subscription.id} has unknown pending tier ${subscription.pendingTierCredits}`,
		);
	}

	return priceLookupKey(
		subscription.plan,
		subscription.pendingTierCredits,
		"year",
	);
}

async function snapshotIsCurrent(
	subscription: V6MigrationSubscription,
	dependencies: V6MigrationDependencies,
): Promise<boolean> {
	const current = await dependencies.reloadSubscription(subscription.id);

	return (
		current !== null &&
		current.priceLookupKey === subscription.priceLookupKey &&
		current.pendingTierCredits === subscription.pendingTierCredits &&
		current.cancelAtPeriodEnd === subscription.cancelAtPeriodEnd &&
		current.status === subscription.status
	);
}

function resolveYearlyTarget(
	subscription: V6MigrationSubscription,
	mappedCurrentTier: CreditTier,
):
	| {
			reason: string;
			status: "skipped";
			tierCredits: number;
	  }
	| {
			retargeted: boolean;
			status: "ready";
			tierCredits: CreditTier;
	  } {
	if (subscription.pendingTierCredits === null) {
		return {
			retargeted: false,
			status: "ready",
			tierCredits: mappedCurrentTier,
		};
	}

	const mappedPendingTier = purchasableTierForLegacy(
		subscription.plan,
		subscription.pendingTierCredits,
	);

	if (mappedPendingTier !== null) {
		return {
			retargeted: true,
			status: "ready",
			tierCredits: mappedPendingTier,
		};
	}

	if (
		isPurchasableTier(subscription.plan, subscription.pendingTierCredits) &&
		subscription.pendingTierCredits === mappedCurrentTier &&
		subscription.pendingAppliedBy === null &&
		subscription.provider === "stripe"
	) {
		return {
			retargeted: false,
			status: "ready",
			tierCredits: mappedCurrentTier,
		};
	}

	return {
		reason:
			subscription.pendingTierCredits === mappedCurrentTier
				? "v6 renewal tier is already scheduled"
				: isPurchasableTier(subscription.plan, subscription.pendingTierCredits)
					? `existing pending change to ${subscription.pendingTierCredits} credits is already on the active catalog`
					: `existing pending change to ${subscription.pendingTierCredits} credits is not migratable`,
		status: "skipped",
		tierCredits: subscription.pendingTierCredits,
	};
}

function summaryRow(
	subscription: V6MigrationSubscription,
	newTier: number,
	status: V6MigrationSummaryRow["status"],
	reason: string,
): V6MigrationSummaryRow {
	return {
		effectiveDate: subscription.currentPeriodEnd.toISOString(),
		id: subscription.id,
		interval: subscription.interval,
		newTier,
		oldTier: subscription.tierCredits,
		ownerType: subscription.organizationId !== null ? "organization" : "user",
		plan: subscription.plan,
		provider: subscription.provider,
		reason,
		status,
	};
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const unknownArgs = args.filter((argument) => argument !== "--apply");

	if (unknownArgs.length > 0) {
		throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
	}

	const apply = args.includes("--apply");
	const database = createDb();
	const changeIntentsRepository = new BillingChangeIntentsRepository(database);
	const repository = new SubscriptionsRepository(database);
	const stripeProvider = new StripeProvider();
	const summary: V6MigrationSummaryRow[] = [];

	try {
		const candidates = await database
			.select()
			.from(subscriptions)
			.where(
				and(
					inArray(subscriptions.provider, ["stripe", "manual"]),
					inArray(subscriptions.status, [...ENTITLED_SUBSCRIPTION_STATUSES]),
					inArray(subscriptions.plan, ["pro", "business"]),
					inArray(subscriptions.tierCredits, [...LEGACY_CREDIT_TIERS]),
				),
			)
			.orderBy(asc(subscriptions.currentPeriodEnd), asc(subscriptions.id));
		const dependencies: V6MigrationDependencies = {
			markPendingTierApplied: (providerSubscriptionId, appliedBy) =>
				repository.markPendingTierApplied(providerSubscriptionId, appliedBy),
			reloadSubscription: async (subscriptionId) => {
				const [current] = await database
					.select()
					.from(subscriptions)
					.where(eq(subscriptions.id, subscriptionId))
					.limit(1);

				return current ?? null;
			},
			scheduleSubscriptionDowngrade: (input) =>
				stripeProvider.scheduleSubscriptionDowngrade(input),
			setPendingTierCredits: (providerSubscriptionId, pendingTierCredits) =>
				repository.setPendingTierCredits(
					providerSubscriptionId,
					pendingTierCredits,
				),
			switchSubscriptionPriceWithoutProration: (input) =>
				stripeProvider.switchSubscriptionPriceWithoutProration(input),
			updateLocalTier: async (subscriptionId, tierCredits, lookupKey) => {
				const [updated] = await database
					.update(subscriptions)
					.set({
						priceLookupKey: lookupKey,
						tierCredits,
						updatedAt: new Date(),
					})
					.where(eq(subscriptions.id, subscriptionId))
					.returning({ id: subscriptions.id });

				if (!updated) {
					throw new Error(
						`Local subscription ${subscriptionId} disappeared while updating its v6 tier`,
					);
				}
			},
			withOwnerLock: (snapshot, operation) => {
				const owner = snapshot.organizationId
					? orgOwner(snapshot.organizationId)
					: userOwner(snapshot.userId);

				return changeIntentsRepository.withOwnerLock(owner, async (tx) => {
					const processing =
						await changeIntentsRepository.findOtherProcessingForSubscription(
							snapshot.id,
							MIGRATION_INTENT_SENTINEL,
							tx,
						);

					return processing ? null : operation();
				});
			},
		};

		for (const subscription of candidates) {
			try {
				summary.push(
					await migrateSubscriptionV6(subscription, apply, dependencies),
				);
			} catch (error) {
				summary.push(
					summaryRow(
						subscription,
						purchasableTierForLegacy(
							subscription.plan,
							subscription.tierCredits,
						) ?? subscription.tierCredits,
						"failed",
						errorMessage(error),
					),
				);
			}
		}
	} finally {
		console.log(
			`Pricing v6 subscription migration (${apply ? "APPLY" : "DRY RUN"}; Stripe API ${STRIPE_API_VERSION})`,
		);
		console.table(summary);
		await database.$client.end();
	}

	process.exitCode = migrationExitCode(summary);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

const entrypoint = process.argv[1];

if (entrypoint && fileURLToPath(import.meta.url) === resolve(entrypoint)) {
	await main();
}
