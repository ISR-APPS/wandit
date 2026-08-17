import {
	type AdminAnalyticsAcquisitionResponse,
	type AdminAnalyticsConsumptionBucket,
	type AdminAnalyticsConsumptionBucketPoint,
	type AdminAnalyticsDaysToConvertBucket,
	type AdminAnalyticsDaysToConvertPoint,
	type AdminAnalyticsEngagementResponse,
	type AdminAnalyticsFeaturesResponse,
	type AdminAnalyticsFunnelResponse,
	type AdminAnalyticsFunnelStepKey,
	type AdminAnalyticsGenerationKey,
	type AdminAnalyticsHealthResponse,
	type AdminAnalyticsMrrByPlan,
	type AdminAnalyticsRevenueResponse,
	adminAnalyticsConsumptionBuckets,
	adminAnalyticsDaysToConvertBuckets,
	adminAnalyticsFeatureKeys,
	adminAnalyticsFunnelStepKeys,
	adminAnalyticsGenerationKeys,
	adminAnalyticsMarginAfterAiPlans,
	type BillingInterval,
	type BillingPlanId,
	billingIntervals,
	billingPlanIds,
	CREDIT_TIERS,
	centiCreditsToCredits,
	creditsToCentiCredits,
	priceLookupKey,
	priceUsdFor,
} from "@wandit/contracts";

import type {
	AdminAnalyticsAcquisitionSnapshot,
	AdminAnalyticsEngagementSnapshot,
	AdminAnalyticsFeaturesSnapshot,
	AdminAnalyticsFunnelSnapshot,
	AdminAnalyticsHealthSnapshot,
	AdminAnalyticsRevenueSnapshot,
} from "../../infrastructure/persistence/admin-analytics.repository";

export const LIVE_SUBSCRIPTION_STATUSES = [
	"active",
	"trialing",
	"past_due",
] as const;

// Customer-facing threshold in WHOLE credits (copy strings say "20+
// credits"). Ledger sums are integer centi-credits, so SQL comparisons must
// interpolate the centi variant below.
export const HEALTHY_TRIAL_MIN_CREDITS = 20;
export const HEALTHY_TRIAL_MIN_CENTI_CREDITS = creditsToCentiCredits(
	HEALTHY_TRIAL_MIN_CREDITS,
);
export const HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS = 2;

const QUEUE_INCLUSIVE_GENERATION_KEYS = new Set<AdminAnalyticsGenerationKey>([
	"pages",
	"connectors",
	"leadScraping",
]);

const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

type MrrPrice = {
	interval: BillingInterval;
	mrrMinorExact: number;
	plan: BillingPlanId;
};

type MrrSubscriptionRow =
	AdminAnalyticsRevenueSnapshot["mrrSubscriptions"][number];

export function buildMrrPriceMap(): ReadonlyMap<string, MrrPrice> {
	const prices = new Map<string, MrrPrice>();

	for (const plan of billingPlanIds) {
		for (const tierCredits of CREDIT_TIERS) {
			for (const interval of billingIntervals) {
				const intervalMonths = interval === "year" ? 12 : 1;
				prices.set(priceLookupKey(plan, tierCredits, interval), {
					interval,
					mrrMinorExact:
						(priceUsdFor(plan, tierCredits, interval) * 100) / intervalMonths,
					plan,
				});
			}
		}
	}

	return prices;
}

export const MRR_PRICE_MAP = buildMrrPriceMap();

export function safePercentage(numerator: number, denominator: number): number {
	if (
		!Number.isFinite(numerator) ||
		!Number.isFinite(denominator) ||
		numerator <= 0 ||
		denominator <= 0
	) {
		return 0;
	}

	return roundTo(Math.min(100, (numerator / denominator) * 100), 1);
}

// creditsConsumed is DECIMAL display credits — convert centi-credit sums with
// centiCreditsToCredits before calling (SQL sites use the centi constant).
export function isHealthyTrialActivity(
	creditsConsumed: number,
	completedGenerations: number,
): boolean {
	return (
		creditsConsumed >= HEALTHY_TRIAL_MIN_CREDITS &&
		completedGenerations >= HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS
	);
}

export function daysToConvertBucket(
	days: number,
): AdminAnalyticsDaysToConvertBucket {
	const normalizedDays = normalizeBucketValue(days);

	if (normalizedDays <= 3) {
		return String(normalizedDays) as AdminAnalyticsDaysToConvertBucket;
	}
	if (normalizedDays <= 5) return "4-5";
	if (normalizedDays <= 7) return "6-7";
	if (normalizedDays <= 14) return "8-14";
	return "15+";
}

// Bucket boundaries keep their CUSTOMER meaning (whole credits) —
// creditsConsumed is DECIMAL display credits, so centi-credit sums must be
// divided by 100 before bucketing.
export function consumptionBucket(
	creditsConsumed: number,
): AdminAnalyticsConsumptionBucket {
	const normalizedCredits = normalizeBucketValue(creditsConsumed);

	if (normalizedCredits === 0) return "0";
	if (normalizedCredits <= 9) return "1-9";
	if (normalizedCredits <= 24) return "10-24";
	if (normalizedCredits <= 39) return "25-39";
	if (normalizedCredits <= 49) return "40-49";
	return "50+";
}

export function assembleAcquisitionResponse(
	snapshot: AdminAnalyticsAcquisitionSnapshot,
	generatedAt: Date,
): AdminAnalyticsAcquisitionResponse {
	const sources = normalizedAcquisitionSources(snapshot.sources);
	const hasCostMetrics =
		snapshot.costs.costCoverageComplete && !snapshot.costsAttributionFiltered;
	const paidUsers = sources.reduce((sum, source) => sum + source.paid, 0);

	return {
		updatedAt: generatedAt.toISOString(),
		adSpendCents: hasCostMetrics ? snapshot.costs.adSpendCents : null,
		cacCents: hasCostMetrics
			? centsPerOwner(snapshot.costs.adSpendCents, paidUsers)
			: null,
		costCoverageComplete: snapshot.costs.costCoverageComplete,
		sources: sources.map((source) => ({
			...acquisitionSourceCosts(source, snapshot, hasCostMetrics),
			source: source.source,
			signups: source.signups,
			activated: source.activated,
			paid: source.paid,
			signupToPaidPct: safePercentage(source.paid, source.signups),
			mrrCents: Math.round(exactMrr(source.mrrSubscriptions)),
		})),
		campaigns: snapshot.campaigns.map((campaign) => ({
			campaign: campaign.campaign,
			source: campaign.source,
			signups: campaign.signups,
			paid: campaign.paid,
			mrrCents: Math.round(exactMrr(campaign.mrrSubscriptions)),
		})),
		countries: snapshot.countries,
		unattributed: { signups: snapshot.unattributedSignups },
	};
}

export function assembleFunnelResponse(
	snapshot: AdminAnalyticsFunnelSnapshot,
	generatedAt: Date,
): AdminAnalyticsFunnelResponse {
	const counts: Record<AdminAnalyticsFunnelStepKey, number | null> = {
		visitor: snapshot.visitors,
		signup: snapshot.signups,
		firstAction: snapshot.firstActions,
		activated: snapshot.activated,
		healthyTrial: snapshot.healthyTrials,
		pricingViewed: snapshot.pricingViewed,
		upgradeClicked: snapshot.upgradeClicked,
		checkoutStarted: snapshot.checkoutStarted,
		paid: snapshot.paid,
	};

	return {
		updatedAt: generatedAt.toISOString(),
		steps: adminAnalyticsFunnelStepKeys.map((key, index) => {
			const count = counts[key];
			const previousKey = adminAnalyticsFunnelStepKeys[index - 1];
			const previousCount =
				previousKey === undefined ? null : counts[previousKey];

			return {
				key,
				count,
				pctOfPrevious:
					count === null || previousCount === null
						? null
						: safePercentage(count, previousCount),
			};
		}),
		durations: {
			signupToFirstAction: assembleDuration(
				snapshot.durations.signupToFirstAction,
			),
			signupToFirstGeneration: assembleDuration(
				snapshot.durations.signupToFirstGeneration,
			),
		},
	};
}

export function assembleEngagementResponse(
	snapshot: AdminAnalyticsEngagementSnapshot,
	generatedAt: Date,
): AdminAnalyticsEngagementResponse {
	return {
		updatedAt: generatedAt.toISOString(),
		activity: {
			dau: snapshot.activity.dau,
			wau: snapshot.activity.wau,
			mau: snapshot.activity.mau,
			dauMauPct: safePercentage(snapshot.activity.dau, snapshot.activity.mau),
			avgActiveDaysPerUser: safeAverage(
				snapshot.activity.activeDays,
				snapshot.activity.activeUsers,
			),
			avgActionsPerUser: zeroSafeRatio(
				snapshot.activity.actions,
				snapshot.activity.actingUsers,
			),
			activeFreeTrialUsers: snapshot.activity.activeFreeTrialUsers,
		},
		activityByDay: snapshot.activityByDay,
		// Each numerator is activity on the exact UTC calendar date signup + X;
		// the repository excludes signups that have not yet reached day X.
		returning: {
			d1Pct: returningPercentage(snapshot.returning, 1),
			d3Pct: returningPercentage(snapshot.returning, 3),
			d7Pct: returningPercentage(snapshot.returning, 7),
			d14Pct: returningPercentage(snapshot.returning, 14),
			d30Pct: returningPercentage(snapshot.returning, 30),
		},
		cohorts: assembleEngagementCohorts(snapshot.cohorts),
		healthyTrialsByDay: snapshot.healthyTrialsByDay,
	};
}

export function assembleRevenueResponse(
	snapshot: AdminAnalyticsRevenueSnapshot,
	generatedAt: Date,
): AdminAnalyticsRevenueResponse {
	const mrr = aggregateMrr(snapshot.mrrSubscriptions, snapshot.activePaidUsers);
	const cohort = snapshot.trialCohort;
	const churn = assembleChurn(snapshot, mrr.arpuMinor);
	const grossCents = snapshot.collectedRevenueByDay.reduce(
		(sum, point) => sum + point.subscriptionsMinor + point.ordersMinor,
		0,
	);
	const netRevenue = {
		grossCents,
		refundsCents: snapshot.paymentAdjustments.refundsCents,
		netCents: grossCents - snapshot.paymentAdjustments.refundsCents,
		failedPayments: snapshot.paymentAdjustments.failedPayments,
		failedPaymentsCents: snapshot.paymentAdjustments.failedPaymentsCents,
	};
	const bySource = snapshot.revenueBySource;
	const domainMarginCents = bySource.domainsCents - bySource.domainCostCents;
	const revenueBySource = {
		subscriptionsCents: bySource.subscriptionsCents,
		domainsCents: bySource.domainsCents,
		domainOrders: bySource.domainOrders,
		domainCostCents: bySource.domainCostCents,
		domainMarginCents,
		domainMarginPct:
			bySource.domainsCents > 0
				? (domainMarginCents / bySource.domainsCents) * 100
				: null,
		domainCostUnknownOrders: bySource.domainCostUnknownOrders,
	};

	return {
		updatedAt: generatedAt.toISOString(),
		tiles: {
			mrrMinor: mrr.mrrMinor,
			arpuMinor: mrr.arpuMinor,
			activePaidUsers: snapshot.activePaidUsers,
			newPaidUsersInRange: snapshot.newPaidUsersInRange,
			trialToPaidPctAllTime: safePercentage(
				cohort.paidUsers,
				cohort.matureUsers,
			),
			healthyTrials: {
				count: cohort.healthyTrials,
				pctOfTrials: safePercentage(cohort.healthyTrials, cohort.trials),
				healthyToPaidPct: safePercentage(
					cohort.healthyPaidUsers,
					cohort.healthyUsers,
				),
				nonHealthyToPaidPct: safePercentage(
					cohort.nonHealthyPaidUsers,
					cohort.nonHealthyUsers,
				),
			},
		},
		mrrByPlan: mrr.mrrByPlan,
		collectedRevenueByDay: snapshot.collectedRevenueByDay,
		newPaidByDay: snapshot.newPaidByDay,
		daysToConvert: bucketDaysToConvert(snapshot.daysToConvert),
		checkoutFunnel: {
			...snapshot.checkoutFunnel,
			completionPct: safePercentage(
				snapshot.checkoutFunnel.completed,
				snapshot.checkoutFunnel.started,
			),
		},
		churn,
		netRevenue,
		revenueBySource,
		arpuByPlan: assembleArpuByPlan(snapshot),
		retention: assembleRetention(snapshot.retention),
		churnBreakdown: assembleChurnBreakdown(snapshot.churnBreakdown),
		unitEconomics: assembleUnitEconomics(
			snapshot,
			mrr.arpuMinor,
			churn.ltvCents,
			netRevenue.netCents,
		),
		marginAfterAi: assembleMarginAfterAi(snapshot.marginAfterAi),
	};
}

export function assembleFeaturesResponse(
	snapshot: AdminAnalyticsFeaturesSnapshot,
	generatedAt: Date,
): AdminAnalyticsFeaturesResponse {
	const featureTotals = new Map(
		adminAnalyticsFeatureKeys.map((key) => [
			key,
			{ convertedAfterUseUsers: 0, paidUsers: 0, users: 0, uses: 0 },
		]),
	);

	for (const feature of snapshot.features) {
		const totals = featureTotals.get(feature.key);
		if (!totals) continue;
		totals.users += feature.users;
		totals.uses += feature.uses;
		totals.paidUsers += feature.paidUsers;
		totals.convertedAfterUseUsers += feature.convertedAfterUseUsers;
	}

	return {
		updatedAt: generatedAt.toISOString(),
		activeUsersInRange: snapshot.activeUsersInRange,
		features: adminAnalyticsFeatureKeys.map((key) => {
			const totals = featureTotals.get(key) ?? {
				convertedAfterUseUsers: 0,
				paidUsers: 0,
				users: 0,
				uses: 0,
			};

			return {
				key,
				users: totals.users,
				pctOfActiveUsers: safePercentage(
					totals.users,
					snapshot.activeUsersInRange,
				),
				uses: totals.uses,
				avgUsesPerUser: safeAverage(totals.uses, totals.users),
				usersToPaidPct: safePercentage(totals.paidUsers, totals.users),
				convertedAfterUsePct: nullablePercentage(
					totals.convertedAfterUseUsers,
					totals.users,
				),
			};
		}),
		ads: {
			analysis: {
				events: snapshot.ads.analysis.events,
				users: snapshot.ads.analysis.users,
				errorRatePct: nullablePercentage(
					snapshot.ads.analysis.failed,
					snapshot.ads.analysis.events + snapshot.ads.analysis.failed,
				),
			},
			launch: {
				events: snapshot.ads.launch.events,
				users: snapshot.ads.launch.users,
				errorRatePct: nullablePercentage(
					snapshot.ads.launch.failed,
					snapshot.ads.launch.events + snapshot.ads.launch.failed,
				),
			},
			connectedUsers: snapshot.ads.connectedUsers,
			totalUsers: snapshot.ads.totalUsers,
			connectedPct: nullablePercentage(
				snapshot.ads.connectedUsers,
				snapshot.ads.totalUsers,
			),
		},
		// Snapshot credit sums are integer centi-credits; the response carries
		// decimal credits, and per-credit ratios divide by CREDITS, not centi.
		credits: {
			grantedInRange: centiCreditsToCredits(snapshot.credits.grantedInRange),
			consumedInRange: centiCreditsToCredits(snapshot.credits.consumedInRange),
			avgConsumedPerFreeUser: safeAverage(
				centiCreditsToCredits(snapshot.credits.freeConsumedInRange),
				snapshot.credits.freeOwnersInRange,
			),
			avgConsumedPerPaidUser: safeAverage(
				centiCreditsToCredits(snapshot.credits.paidConsumedInRange),
				snapshot.credits.paidOwnersInRange,
			),
			consumptionBuckets: bucketConsumption(
				snapshot.credits.freeConsumptionTotals,
			),
			usersAtZeroBalance: snapshot.credits.usersAtZeroBalance,
			avgCreditsBeforeUpgrade: safeAverage(
				centiCreditsToCredits(snapshot.credits.creditsBeforeUpgradeTotal),
				snapshot.credits.convertedUsers,
			),
			providerCostPerCreditMicros: safeAverage(
				snapshot.credits.providerCostMicros,
				centiCreditsToCredits(snapshot.credits.consumedInRange),
				2,
			),
		},
		freeCredits: {
			avgDaysToConsume: secondsToDays(snapshot.freeCredits.avgSecondsToConsume),
			medianDaysToConsume: secondsToDays(
				snapshot.freeCredits.medianSecondsToConsume,
			),
			measuredUsers: snapshot.freeCredits.measuredUsers,
		},
		conversionByCredits: bucketConversionByCredits(
			snapshot.conversionByCredits,
		),
	};
}

export function assembleHealthResponse(
	snapshot: AdminAnalyticsHealthSnapshot,
	generatedAt: Date,
): AdminAnalyticsHealthResponse {
	const generationByKey = new Map(
		snapshot.generation.map((generation) => [generation.key, generation]),
	);

	return {
		updatedAt: generatedAt.toISOString(),
		generation: adminAnalyticsGenerationKeys.map((key) => {
			const generation = generationByKey.get(key) ?? {
				attempts: 0,
				failed: 0,
				key,
				p50Ms: 0,
				p95Ms: 0,
				successful: 0,
				topFailures: [],
			};

			return {
				key,
				attempts: generation.attempts,
				successPct: safePercentage(generation.successful, generation.attempts),
				failurePct: safePercentage(generation.failed, generation.attempts),
				p50Ms: generation.p50Ms,
				p95Ms: generation.p95Ms,
				latencyIncludesQueue: QUEUE_INCLUSIVE_GENERATION_KEYS.has(key),
				topFailures: generation.topFailures,
			};
		}),
		creditsRefundedInRange: centiCreditsToCredits(
			snapshot.creditsRefundedInRange,
		),
		webhooks: snapshot.webhooks,
	};
}

export function aggregateMrr(
	subscriptions: MrrSubscriptionRow[],
	activePaidUsers: number,
): {
	arpuMinor: number;
	mrrByPlan: AdminAnalyticsMrrByPlan[];
	mrrMinor: number;
} {
	const groupTotals = new Map<
		string,
		{ mrrMinorExact: number; subscribers: number }
	>();
	let totalMrrMinorExact = 0;

	for (const subscription of subscriptions) {
		const price = MRR_PRICE_MAP.get(subscription.priceLookupKey);
		if (!price) continue;

		const groupKey = mrrGroupKey(price.plan, price.interval);
		const group = groupTotals.get(groupKey) ?? {
			mrrMinorExact: 0,
			subscribers: 0,
		};
		const rowMrrMinorExact = price.mrrMinorExact * subscription.subscribers;

		group.mrrMinorExact += rowMrrMinorExact;
		group.subscribers += subscription.subscribers;
		groupTotals.set(groupKey, group);
		totalMrrMinorExact += rowMrrMinorExact;
	}

	return {
		mrrMinor: Math.round(totalMrrMinorExact),
		arpuMinor:
			activePaidUsers > 0
				? Math.round(totalMrrMinorExact / activePaidUsers)
				: 0,
		mrrByPlan: billingPlanIds.flatMap((plan) =>
			billingIntervals.map((interval) => {
				const group = groupTotals.get(mrrGroupKey(plan, interval));
				return {
					plan,
					interval,
					subscribers: group?.subscribers ?? 0,
					mrrMinor: Math.round(group?.mrrMinorExact ?? 0),
				};
			}),
		),
	};
}

function acquisitionSourceCosts(
	source: AdminAnalyticsAcquisitionSnapshot["sources"][number],
	snapshot: AdminAnalyticsAcquisitionSnapshot,
	hasCostMetrics: boolean,
): Pick<
	AdminAnalyticsAcquisitionResponse["sources"][number],
	"adSpendCents" | "cacCents"
> {
	if (!hasCostMetrics) return { adSpendCents: null, cacCents: null };

	const sourceKey = source.source.trim().toLowerCase();
	const adSpendCents = snapshot.costs.adSpendBySourceCents[sourceKey] ?? 0;

	return {
		adSpendCents,
		cacCents: centsPerOwner(adSpendCents, source.paid),
	};
}

function normalizedAcquisitionSources(
	sources: AdminAnalyticsAcquisitionSnapshot["sources"],
): AdminAnalyticsAcquisitionSnapshot["sources"] {
	const normalized = new Map<
		string,
		AdminAnalyticsAcquisitionSnapshot["sources"][number]
	>();

	for (const source of sources) {
		const key = source.source.trim().toLowerCase() || "unknown";
		const existing = normalized.get(key);
		if (existing) {
			existing.signups += source.signups;
			existing.activated += source.activated;
			existing.paid += source.paid;
			existing.mrrSubscriptions.push(...source.mrrSubscriptions);
			continue;
		}

		normalized.set(key, {
			...source,
			source: key,
			mrrSubscriptions: [...source.mrrSubscriptions],
		});
	}

	return [...normalized.values()];
}

function assembleUnitEconomics(
	snapshot: AdminAnalyticsRevenueSnapshot,
	arpuMinor: number,
	ltvCents: number | null,
	netRevenueCents: number,
): AdminAnalyticsRevenueResponse["unitEconomics"] {
	const costs = snapshot.costs;
	if (!costs.costCoverageComplete) {
		return {
			adSpendCents: null,
			infrastructureCostCents: null,
			otherCostCents: null,
			totalCostCents: null,
			cacCents: null,
			ltvCacRatio: null,
			grossMarginPct: null,
			cacPaybackMonths: null,
			costPerFreeActiveUserCents: null,
			costPerHealthyTrialCents: null,
			costPerActivePaidUserCents: null,
			costCoverageComplete: false,
		};
	}

	const cacCents = centsPerOwner(costs.adSpendCents, snapshot.cohortPaidUsers);
	const grossMarginPct =
		netRevenueCents > 0
			? roundTo(
					Math.max(
						0,
						Math.min(
							100,
							((netRevenueCents - costs.infrastructureCostCents) /
								netRevenueCents) *
								100,
						),
					),
					1,
				)
			: null;
	const contributionPerPaidUser =
		grossMarginPct !== null && grossMarginPct > 0 && arpuMinor > 0
			? arpuMinor * (grossMarginPct / 100)
			: null;

	return {
		adSpendCents: costs.adSpendCents,
		infrastructureCostCents: costs.infrastructureCostCents,
		otherCostCents: costs.otherCostCents,
		totalCostCents: costs.totalCostCents,
		cacCents,
		ltvCacRatio:
			ltvCents !== null && cacCents !== null && cacCents > 0
				? roundTo(ltvCents / cacCents, 2)
				: null,
		grossMarginPct,
		cacPaybackMonths:
			cacCents !== null &&
			cacCents > 0 &&
			contributionPerPaidUser !== null &&
			contributionPerPaidUser > 0
				? roundTo(cacCents / contributionPerPaidUser, 1)
				: null,
		costPerFreeActiveUserCents: centsPerOwner(
			costs.totalCostCents,
			snapshot.freeOwnersInRange,
		),
		costPerHealthyTrialCents: centsPerOwner(
			costs.totalCostCents,
			snapshot.healthyTrialsInRange,
		),
		costPerActivePaidUserCents: centsPerOwner(
			costs.totalCostCents,
			snapshot.paidOwnersInRange,
		),
		costCoverageComplete: true,
	};
}

function centsPerOwner(cents: number, owners: number): number | null {
	if (!Number.isFinite(cents) || !Number.isFinite(owners) || owners <= 0) {
		return null;
	}

	return Math.max(0, Math.round(cents / owners));
}

function assembleDuration(
	duration: AdminAnalyticsFunnelSnapshot["durations"]["signupToFirstAction"],
): AdminAnalyticsFunnelResponse["durations"]["signupToFirstAction"] {
	return {
		medianHours: secondsToHours(duration.medianSeconds),
		avgHours: secondsToHours(duration.avgSeconds),
		users: duration.users,
	};
}

function returningPercentage(
	rows: AdminAnalyticsEngagementSnapshot["returning"],
	day: 1 | 3 | 7 | 14 | 30,
): number {
	let eligibleUsers = 0;
	let returningUsers = 0;

	for (const row of rows) {
		if (row.day !== day) continue;
		eligibleUsers += row.eligibleUsers;
		returningUsers += row.returningUsers;
	}

	return safePercentage(returningUsers, eligibleUsers);
}

function assembleEngagementCohorts(
	rows: AdminAnalyticsEngagementSnapshot["cohorts"],
): AdminAnalyticsEngagementResponse["cohorts"] {
	const grouped = new Map<
		string,
		{ size: number; activeUsersByWeek: Map<number, number> }
	>();

	for (const row of rows) {
		if (!Number.isFinite(row.weekIndex) || row.weekIndex < 0) continue;

		const weekIndex = Math.floor(row.weekIndex);
		const cohort = grouped.get(row.cohortWeekStart) ?? {
			size: 0,
			activeUsersByWeek: new Map<number, number>(),
		};
		cohort.size = Math.max(cohort.size, row.size);
		cohort.activeUsersByWeek.set(
			weekIndex,
			(cohort.activeUsersByWeek.get(weekIndex) ?? 0) + row.activeUsers,
		);
		grouped.set(row.cohortWeekStart, cohort);
	}

	return [...grouped.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([cohortWeekStart, cohort]) => {
			const maxWeekIndex = Math.max(-1, ...cohort.activeUsersByWeek.keys());

			return {
				cohortWeekStart,
				size: cohort.size,
				weeks: Array.from({ length: maxWeekIndex + 1 }, (_, weekIndex) =>
					safePercentage(
						cohort.activeUsersByWeek.get(weekIndex) ?? 0,
						cohort.size,
					),
				),
			};
		});
}

function assembleChurn(
	snapshot: AdminAnalyticsRevenueSnapshot,
	arpuMinor: number,
): AdminAnalyticsRevenueResponse["churn"] {
	const lifecycle = snapshot.lifecycle;
	const churnedMrrExact = exactMrr(lifecycle.churnedSubscriptions);
	const mrrAtStartExact = exactMrr(lifecycle.mrrAtStartSubscriptions);
	const customerChurnPct = nullablePercentage(
		lifecycle.churnedOwners,
		lifecycle.activePaidOwnersAtStart,
	);
	const mrrChurnPct = nullablePercentage(churnedMrrExact, mrrAtStartExact);
	let upgrades = 0;
	let downgrades = 0;
	let upgradeMrrExact = 0;
	let downgradeMrrExact = 0;

	for (const change of lifecycle.planChanges) {
		if (change.fromLookupKey === null || change.toLookupKey === null) continue;

		const fromPrice = MRR_PRICE_MAP.get(change.fromLookupKey);
		const toPrice = MRR_PRICE_MAP.get(change.toLookupKey);
		if (!fromPrice || !toPrice) continue;

		const delta =
			(toPrice.mrrMinorExact - fromPrice.mrrMinorExact) * change.count;
		if (delta > 0) {
			upgrades += change.count;
			upgradeMrrExact += delta;
		} else if (delta < 0) {
			downgrades += change.count;
			downgradeMrrExact += -delta;
		}
	}

	const monthlyChurnPct =
		customerChurnPct === null || snapshot.daysInRange <= 0
			? null
			: customerChurnPct * (30.44 / snapshot.daysInRange);
	const ltvCents =
		lifecycle.churnedOwners <= 0 ||
		monthlyChurnPct === null ||
		monthlyChurnPct <= 0
			? null
			: Math.round(arpuMinor / (monthlyChurnPct / 100));

	return {
		customerChurnPct,
		mrrChurnPct,
		churnedMrrCents: Math.round(churnedMrrExact),
		netNewMrrCents: Math.round(
			exactMrr(lifecycle.createdSubscriptions) +
				upgradeMrrExact -
				downgradeMrrExact -
				churnedMrrExact,
		),
		upgrades,
		downgrades,
		ltvCents,
	};
}

function assembleArpuByPlan(
	snapshot: AdminAnalyticsRevenueSnapshot,
): AdminAnalyticsRevenueResponse["arpuByPlan"] {
	const ownersByPlan = new Map<BillingPlanId, number>();
	for (const row of snapshot.mrrPlanOwners) {
		ownersByPlan.set(row.plan, (ownersByPlan.get(row.plan) ?? 0) + row.owners);
	}

	return billingPlanIds.map((plan) => {
		const owners = ownersByPlan.get(plan) ?? 0;
		return {
			plan,
			arpuCents:
				owners > 0
					? Math.round(exactMrr(snapshot.mrrSubscriptions, plan) / owners)
					: 0,
		};
	});
}

// Measured margin only: the plan's collected subscription cash minus the
// metered AI-provider cost of that plan's owners. Shared infrastructure and
// ad spend stay out — they belong to the blended unitEconomics margin. The
// contract fixes the row order (pro, business, free), so every plan the
// repository never saw still emits a zero row, and "free" — which can never
// collect cash — reports its AI cost as a negative margin with no percent.
function assembleMarginAfterAi(
	rows: AdminAnalyticsRevenueSnapshot["marginAfterAi"],
): AdminAnalyticsRevenueResponse["marginAfterAi"] {
	const totals = new Map<string, { aiCostCents: number; revenueCents: number }>(
		adminAnalyticsMarginAfterAiPlans.map((plan) => [
			plan,
			{ aiCostCents: 0, revenueCents: 0 },
		]),
	);

	for (const row of rows) {
		// A plan outside the contract order has no row to land in.
		const total = totals.get(row.plan);
		if (!total) continue;

		total.revenueCents += row.revenueCents;
		total.aiCostCents += row.aiCostCents;
	}

	return adminAnalyticsMarginAfterAiPlans.map((plan) => {
		const total = totals.get(plan) ?? { aiCostCents: 0, revenueCents: 0 };
		const marginCents = total.revenueCents - total.aiCostCents;

		return {
			plan,
			revenueCents: total.revenueCents,
			aiCostCents: total.aiCostCents,
			marginCents,
			marginPct:
				total.revenueCents > 0
					? roundTo((marginCents / total.revenueCents) * 100, 1)
					: null,
		};
	});
}

function assembleRetention(
	retention: AdminAnalyticsRevenueSnapshot["retention"],
): AdminAnalyticsRevenueResponse["retention"] {
	return {
		cohorts: retention.cohorts.map((cohort) => {
			const pointsByMonth = new Map<number, (typeof cohort.points)[number]>();

			for (const point of cohort.points) {
				if (
					!Number.isInteger(point.monthIndex) ||
					point.monthIndex < 0 ||
					point.monthIndex >= 12
				) {
					continue;
				}
				pointsByMonth.set(point.monthIndex, point);
			}

			const maxMonthIndex = Math.max(-1, ...pointsByMonth.keys());
			const m0MrrExact = exactMrr(pointsByMonth.get(0)?.mrrSubscriptions ?? []);

			return {
				cohortMonth: cohort.cohortMonth,
				owners: cohort.owners,
				m0MrrCents: Math.max(0, Math.round(m0MrrExact)),
				points: Array.from({ length: maxMonthIndex + 1 }, (_, monthIndex) => {
					const point = pointsByMonth.get(monthIndex);
					const pointMrrExact = exactMrr(point?.mrrSubscriptions ?? []);

					return {
						paidPct: safePercentage(point?.paidOwners ?? 0, cohort.owners),
						revenuePct: nullableUnboundedPercentage(pointMrrExact, m0MrrExact),
					};
				}),
			};
		}),
	};
}

function assembleChurnBreakdown(
	breakdown: AdminAnalyticsRevenueSnapshot["churnBreakdown"],
): AdminAnalyticsRevenueResponse["churnBreakdown"] {
	return {
		byPlan: sortChurnRows(
			breakdown.byPlan.map((row) => ({
				plan: row.plan,
				churned: row.churned,
				churnedMrrCents: Math.max(
					0,
					Math.round(exactMrr(row.mrrSubscriptions)),
				),
			})),
			(row) => row.plan,
		),
		bySource: sortChurnRows(
			breakdown.bySource.map((row) => ({ ...row })),
			(row) => row.source,
		),
		byReason: sortChurnRows(
			breakdown.byReason.map((row) => ({ ...row })),
			(row) => row.reason,
		),
		byCountry: sortChurnRows(
			breakdown.byCountry.map((row) => ({ ...row })),
			(row) => row.country,
		),
		byFeature: sortChurnRows(
			breakdown.byFeature.map((row) => ({ ...row })),
			(row) => row.feature,
		),
	};
}

function exactMrr(
	rows: ReadonlyArray<{
		priceLookupKey: string;
		subscribers?: number;
		subscriptions?: number;
	}>,
	plan?: BillingPlanId,
): number {
	let total = 0;

	for (const row of rows) {
		const price = MRR_PRICE_MAP.get(row.priceLookupKey);
		if (!price || (plan !== undefined && price.plan !== plan)) continue;
		total += price.mrrMinorExact * (row.subscribers ?? row.subscriptions ?? 0);
	}

	return total;
}

function nullablePercentage(
	numerator: number,
	denominator: number,
): number | null {
	if (!Number.isFinite(denominator) || denominator <= 0) return null;
	return safePercentage(numerator, denominator);
}

function nullableUnboundedPercentage(
	numerator: number,
	denominator: number,
): number | null {
	if (!Number.isFinite(denominator) || denominator <= 0) return null;
	if (!Number.isFinite(numerator) || numerator <= 0) return 0;
	return roundTo((numerator / denominator) * 100, 1);
}

function bucketDaysToConvert(
	rows: AdminAnalyticsRevenueSnapshot["daysToConvert"],
): AdminAnalyticsDaysToConvertPoint[] {
	const counts = new Map(
		adminAnalyticsDaysToConvertBuckets.map((bucket) => [bucket, 0]),
	);

	for (const row of rows) {
		const bucket = daysToConvertBucket(row.days);
		counts.set(bucket, (counts.get(bucket) ?? 0) + row.count);
	}

	return adminAnalyticsDaysToConvertBuckets.map((bucket) => ({
		bucket,
		count: counts.get(bucket) ?? 0,
	}));
}

function bucketConsumption(
	rows: AdminAnalyticsFeaturesSnapshot["credits"]["freeConsumptionTotals"],
): AdminAnalyticsConsumptionBucketPoint[] {
	const counts = new Map(
		adminAnalyticsConsumptionBuckets.map((bucket) => [bucket, 0]),
	);

	for (const row of rows) {
		// row.consumed is a centi-credit ledger sum; buckets are whole credits.
		const bucket = consumptionBucket(centiCreditsToCredits(row.consumed));
		counts.set(bucket, (counts.get(bucket) ?? 0) + row.users);
	}

	return adminAnalyticsConsumptionBuckets.map((bucket) => ({
		bucket,
		users: counts.get(bucket) ?? 0,
	}));
}

function bucketConversionByCredits(
	rows: AdminAnalyticsFeaturesSnapshot["conversionByCredits"],
): AdminAnalyticsFeaturesResponse["conversionByCredits"] {
	const counts = new Map(
		adminAnalyticsConsumptionBuckets.map((bucket) => [
			bucket,
			{ owners: 0, paidOwners: 0 },
		]),
	);

	for (const row of rows) {
		// row.consumed is a centi-credit ledger sum; buckets are whole credits.
		const bucket = consumptionBucket(centiCreditsToCredits(row.consumed));
		const bucketCounts = counts.get(bucket);
		if (!bucketCounts) continue;
		bucketCounts.owners += row.owners;
		bucketCounts.paidOwners += row.paidOwners;
	}

	return adminAnalyticsConsumptionBuckets.map((bucket) => {
		const bucketCounts = counts.get(bucket) ?? { owners: 0, paidOwners: 0 };

		return {
			bucket,
			owners: bucketCounts.owners,
			paidOwners: bucketCounts.paidOwners,
			paidPct: nullablePercentage(bucketCounts.paidOwners, bucketCounts.owners),
		};
	});
}

function sortChurnRows<T extends { churned: number }>(
	rows: T[],
	label: (row: T) => string,
): T[] {
	return rows.sort(
		(left, right) =>
			right.churned - left.churned || label(left).localeCompare(label(right)),
	);
}

function safeAverage(
	numerator: number,
	denominator: number,
	fractionDigits = 1,
): number {
	if (
		!Number.isFinite(numerator) ||
		!Number.isFinite(denominator) ||
		numerator <= 0 ||
		denominator <= 0
	) {
		return 0;
	}

	return roundTo(numerator / denominator, fractionDigits);
}

function zeroSafeRatio(numerator: number, denominator: number): number {
	if (
		!Number.isFinite(numerator) ||
		!Number.isFinite(denominator) ||
		numerator <= 0 ||
		denominator <= 0
	) {
		return 0;
	}

	return numerator / denominator;
}

function secondsToHours(seconds: number | null): number | null {
	return secondsToUnit(seconds, SECONDS_PER_HOUR);
}

function secondsToDays(seconds: number | null): number | null {
	return secondsToUnit(seconds, SECONDS_PER_DAY);
}

function secondsToUnit(seconds: number | null, secondsPerUnit: number) {
	if (seconds === null || !Number.isFinite(seconds)) return null;
	return Math.max(0, seconds) / secondsPerUnit;
}

function roundTo(value: number, fractionDigits: number): number {
	const scale = 10 ** fractionDigits;
	const rounded = Math.round((value + Number.EPSILON) * scale) / scale;
	return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeBucketValue(value: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function mrrGroupKey(plan: BillingPlanId, interval: BillingInterval): string {
	return `${plan}:${interval}`;
}

export type { MrrPrice };
