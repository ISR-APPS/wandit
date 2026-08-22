import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminAnalyticsDevice,
	type AdminAnalyticsFeatureKey,
	type AdminAnalyticsGenerationKey,
	adminAnalyticsFeatureKeys,
	type BillingPlanId,
	type CancellationReasonCode,
	cancellationReasonCodeSchema,
} from "@wandit/contracts";
import { type SQL, sql } from "@wandit/db";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	HEALTHY_TRIAL_MIN_CENTI_CREDITS,
	HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS,
	LIVE_SUBSCRIPTION_STATUSES,
	MRR_PRICE_MAP,
} from "../../application/services/admin-analytics.metrics";
import {
	type AdminCostAllocation,
	prorateMonthlyCosts,
} from "../../application/services/admin-cost-allocation";
import type { AdminDashboardRangeBounds } from "../../application/services/admin-dashboard-range";
import {
	AI_SPEND_STATUSES,
	aiUsageEventCostUsdMicros,
} from "./ai-usage-cost.sql";

type NumericValue = bigint | number | string | null;

type AdminAnalyticsDbClient = Pick<Database, "execute">;

type RevenueMrrRow = {
	plan: BillingPlanId | null;
	price_lookup_key: string | null;
	subscribers: NumericValue;
	active_paid_users: NumericValue;
	plan_owners: NumericValue;
};

type AcquisitionSourceRow = {
	activated: NumericValue;
	live_subscriptions: NumericValue;
	paid: NumericValue;
	price_lookup_key: string | null;
	signups: NumericValue;
	source: string;
};

type AcquisitionCampaignRow = {
	campaign: string;
	live_subscriptions: NumericValue;
	paid: NumericValue;
	price_lookup_key: string | null;
	signups: NumericValue;
	source: string;
};

type AcquisitionCountryRow = {
	country: string;
	paid: NumericValue;
	signups: NumericValue;
};

type FunnelRow = {
	activated: NumericValue;
	avg_first_action_seconds: NumericValue;
	avg_first_generation_seconds: NumericValue;
	checkout_started: NumericValue;
	first_actions: NumericValue;
	first_action_duration_users: NumericValue;
	first_generation_duration_users: NumericValue;
	healthy_trials: NumericValue;
	pricing_viewed_users: NumericValue;
	upgrade_clicked_users: NumericValue;
	median_first_action_seconds: NumericValue;
	median_first_generation_seconds: NumericValue;
	paid: NumericValue;
	signups: NumericValue;
	visitors: NumericValue;
};

type EngagementActivityRow = {
	actions: NumericValue;
	active_days: NumericValue;
	active_free_trial_users: NumericValue;
	active_users: NumericValue;
	acting_users: NumericValue;
	dau: NumericValue;
	mau: NumericValue;
	wau: NumericValue;
};

type EngagementActivityDayRow = {
	active_users: NumericValue;
	date: string;
};

type EngagementReturningRow = {
	day_offset: NumericValue;
	eligible_users: NumericValue;
	returning_users: NumericValue;
};

type EngagementCohortRow = {
	active_users: NumericValue;
	cohort_size: NumericValue;
	cohort_week_start: string;
	week_index: NumericValue;
};

type EngagementHealthyTrialDayRow = {
	count: NumericValue;
	date: string;
};

type RevenueLifecycleRow = {
	active_paid_at_start: NumericValue;
	churned_owners: NumericValue;
	count: NumericValue;
	from_lookup_key: string | null;
	price_lookup_key: string | null;
	row_kind: "churned" | "created" | "mrr_at_start" | "plan_changed" | "summary";
	to_lookup_key: string | null;
};

type RevenuePaymentAdjustmentsRow = {
	failed_payments: NumericValue;
	failed_payments_cents: NumericValue;
	refunds_cents: NumericValue;
};

type TrialCohortRow = {
	mature_users: NumericValue;
	paid_users: NumericValue;
	trials: NumericValue;
	healthy_trials: NumericValue;
	healthy_users: NumericValue;
	healthy_paid_users: NumericValue;
	non_healthy_users: NumericValue;
	non_healthy_paid_users: NumericValue;
};

type CollectedRevenueRow = {
	date: string;
	subscriptions_minor: NumericValue;
	orders_minor: NumericValue;
};

type RevenueBySourceRow = {
	subscriptions_minor: NumericValue;
	domains_minor: NumericValue;
	domain_orders: NumericValue;
	domain_cost_cents: NumericValue;
	domain_cost_unknown_orders: NumericValue;
};

type MarginAfterAiRow = {
	plan: string;
	revenue_cents: NumericValue;
	ai_cost_cents: NumericValue;
};

type NewPaidRow = {
	date: string;
	count: NumericValue;
};

type DaysToConvertRow = {
	days: NumericValue;
	count: NumericValue;
};

type CheckoutFunnelRow = {
	started: NumericValue;
	completed: NumericValue;
};

type FeatureAdoptionRow = {
	key: AdminAnalyticsFeatureKey | null;
	users: NumericValue;
	uses: NumericValue;
	paid_users: NumericValue;
	converted_after_use_users: NumericValue;
	active_users: NumericValue;
};

type CreditRangeRow = {
	granted_in_range: NumericValue;
	consumed_in_range: NumericValue;
	free_consumed_in_range: NumericValue;
	free_owners_in_range: NumericValue;
	paid_consumed_in_range: NumericValue;
	paid_owners_in_range: NumericValue;
	provider_cost_micros: NumericValue;
};

type FreeConsumptionRow = {
	consumed: NumericValue;
	users: NumericValue;
	users_at_zero_balance: NumericValue;
};

type CreditsBeforeUpgradeRow = {
	credits_before_upgrade_total: NumericValue;
	converted_users: NumericValue;
};

type FreeCreditsRow = {
	avg_seconds_to_consume: NumericValue;
	median_seconds_to_consume: NumericValue;
	measured_users: NumericValue;
};

type ConversionByCreditsRow = {
	consumed: NumericValue;
	owners: NumericValue;
	paid_owners: NumericValue;
};

type RetentionRow = {
	cohort_month: string;
	live_subscriptions: NumericValue;
	month_index: NumericValue;
	owners: NumericValue;
	paid_owners: NumericValue;
	price_lookup_key: string | null;
};

type ChurnBreakdownRow = {
	churned: NumericValue;
	dimension: string;
	price_lookup_key: string | null;
	row_kind: "country" | "feature" | "plan" | "reason" | "source";
	subscriptions: NumericValue;
};

type AdsFeatureRow = {
	analysis_failed: NumericValue;
	analysis_succeeded: NumericValue;
	analysis_users: NumericValue;
	connected_users: NumericValue;
	launch_failed: NumericValue;
	launch_succeeded: NumericValue;
	launch_users: NumericValue;
	total_users: NumericValue;
};

type MonthlyCostAllocationDbRow = {
	ad_spend_by_source_cents: Record<string, number> | null;
	infrastructure_cost_cents: NumericValue;
	month: string;
	other_cost_cents: NumericValue;
};

type GenerationHealthRow = {
	key: AdminAnalyticsGenerationKey;
	attempts: NumericValue;
	successful: NumericValue;
	failed: NumericValue;
	p50_ms: NumericValue;
	p95_ms: NumericValue;
};

type TopFailureRow = {
	code: string;
	count: NumericValue;
};

type CreditsRefundedRow = {
	credits_refunded: NumericValue;
};

type WebhookHealthRow = {
	received: NumericValue;
	processed: NumericValue;
	skipped: NumericValue;
	failed: NumericValue;
	dead_lettered: NumericValue;
};

export type AdminAnalyticsRevenueRepositorySnapshot = {
	activePaidUsers: number;
	mrrSubscriptions: Array<{
		priceLookupKey: string;
		subscribers: number;
	}>;
	mrrPlanOwners: Array<{
		owners: number;
		plan: BillingPlanId;
	}>;
	daysInRange: number;
	newPaidUsersInRange: number;
	cohortPaidUsers: number;
	costs: AdminCostAllocation;
	freeOwnersInRange: number;
	healthyTrialsInRange: number;
	paidOwnersInRange: number;
	trialCohort: {
		matureUsers: number;
		paidUsers: number;
		trials: number;
		healthyTrials: number;
		healthyUsers: number;
		healthyPaidUsers: number;
		nonHealthyUsers: number;
		nonHealthyPaidUsers: number;
	};
	collectedRevenueByDay: Array<{
		date: string;
		subscriptionsMinor: number;
		ordersMinor: number;
	}>;
	revenueBySource: {
		subscriptionsCents: number;
		domainsCents: number;
		domainOrders: number;
		domainCostCents: number;
		domainCostUnknownOrders: number;
	};
	// One row per plan that collected cash or burned AI cost in range. "free"
	// covers every owner without a live subscription. The assembler owns the
	// contract order and fills the plans this query never saw.
	marginAfterAi: Array<{
		plan: string;
		revenueCents: number;
		aiCostCents: number;
	}>;
	newPaidByDay: Array<{ date: string; count: number }>;
	daysToConvert: Array<{ days: number; count: number }>;
	checkoutFunnel: { started: number; completed: number };
	lifecycle: {
		activePaidOwnersAtStart: number;
		churnedOwners: number;
		mrrAtStartSubscriptions: Array<{
			priceLookupKey: string;
			subscriptions: number;
		}>;
		churnedSubscriptions: Array<{
			priceLookupKey: string;
			subscriptions: number;
		}>;
		createdSubscriptions: Array<{
			priceLookupKey: string;
			subscriptions: number;
		}>;
		planChanges: Array<{
			count: number;
			fromLookupKey: string | null;
			toLookupKey: string | null;
		}>;
	};
	paymentAdjustments: {
		failedPayments: number;
		failedPaymentsCents: number;
		refundsCents: number;
	};
	retention: {
		cohorts: Array<{
			cohortMonth: string;
			owners: number;
			points: Array<{
				monthIndex: number;
				paidOwners: number;
				mrrSubscriptions: Array<{
					priceLookupKey: string;
					subscriptions: number;
				}>;
			}>;
		}>;
	};
	churnBreakdown: {
		byPlan: Array<{
			plan: string;
			churned: number;
			mrrSubscriptions: Array<{
				priceLookupKey: string;
				subscriptions: number;
			}>;
		}>;
		bySource: Array<{ source: string; churned: number }>;
		byReason: Array<{
			reason: CancellationReasonCode | "unknown";
			churned: number;
		}>;
		byCountry: Array<{ country: string; churned: number }>;
		byFeature: Array<{ feature: AdminAnalyticsFeatureKey; churned: number }>;
	};
};

export type AdminAnalyticsAcquisitionRepositorySnapshot = {
	costs: AdminCostAllocation;
	costsAttributionFiltered: boolean;
	sources: Array<{
		source: string;
		signups: number;
		activated: number;
		paid: number;
		mrrSubscriptions: Array<{
			priceLookupKey: string;
			subscribers: number;
		}>;
	}>;
	campaigns: Array<{
		campaign: string;
		source: string;
		signups: number;
		paid: number;
		mrrSubscriptions: Array<{
			priceLookupKey: string;
			subscribers: number;
		}>;
	}>;
	countries: Array<{ country: string; signups: number; paid: number }>;
	unattributedSignups: number;
};

export type AdminAnalyticsFunnelRepositorySnapshot = {
	visitors: number | null;
	signups: number;
	firstActions: number;
	activated: number;
	healthyTrials: number;
	pricingViewed: number;
	upgradeClicked: number;
	checkoutStarted: number;
	paid: number;
	durations: {
		signupToFirstAction: {
			medianSeconds: number | null;
			avgSeconds: number | null;
			users: number;
		};
		signupToFirstGeneration: {
			medianSeconds: number | null;
			avgSeconds: number | null;
			users: number;
		};
	};
};

export type AdminAnalyticsEngagementRepositorySnapshot = {
	activity: {
		dau: number;
		wau: number;
		mau: number;
		activeDays: number;
		activeUsers: number;
		activeFreeTrialUsers: number;
		actions: number;
		actingUsers: number;
	};
	activityByDay: Array<{ date: string; activeUsers: number }>;
	returning: Array<{
		day: 1 | 3 | 7 | 14 | 30;
		eligibleUsers: number;
		returningUsers: number;
	}>;
	cohorts: Array<{
		cohortWeekStart: string;
		size: number;
		weekIndex: number;
		activeUsers: number;
	}>;
	healthyTrialsByDay: Array<{ date: string; count: number }>;
};

export type AdminAnalyticsOverviewMetricsRepositorySnapshot = {
	activePaidUsers: number;
	mrrSubscriptions: Array<{
		priceLookupKey: string;
		subscribers: number;
	}>;
	healthyTrials: number;
};

export type AdminAnalyticsFeaturesRepositorySnapshot = {
	activeUsersInRange: number;
	features: Array<{
		key: AdminAnalyticsFeatureKey;
		users: number;
		uses: number;
		paidUsers: number;
		convertedAfterUseUsers: number;
	}>;
	ads: {
		analysis: { events: number; failed: number; users: number };
		launch: { events: number; failed: number; users: number };
		connectedUsers: number;
		totalUsers: number;
	};
	credits: {
		grantedInRange: number;
		consumedInRange: number;
		freeConsumedInRange: number;
		freeOwnersInRange: number;
		paidConsumedInRange: number;
		paidOwnersInRange: number;
		freeConsumptionTotals: Array<{ consumed: number; users: number }>;
		usersAtZeroBalance: number;
		creditsBeforeUpgradeTotal: number;
		convertedUsers: number;
		providerCostMicros: number;
	};
	freeCredits: {
		avgSecondsToConsume: number | null;
		medianSecondsToConsume: number | null;
		measuredUsers: number;
	};
	conversionByCredits: Array<{
		consumed: number;
		owners: number;
		paidOwners: number;
	}>;
};

export type AdminAnalyticsFilters = {
	source?: string;
	country?: string;
	device?: AdminAnalyticsDevice;
	cohortOnly?: boolean;
};

export type AdminAnalyticsHealthRepositorySnapshot = {
	generation: Array<{
		key: AdminAnalyticsGenerationKey;
		attempts: number;
		successful: number;
		failed: number;
		p50Ms: number;
		p95Ms: number;
		topFailures: Array<{ code: string; count: number }>;
	}>;
	creditsRefundedInRange: number;
	webhooks: {
		received: number;
		processed: number;
		skipped: number;
		failed: number;
		deadLettered: number;
	};
};

export type AdminAnalyticsRevenueSnapshot =
	AdminAnalyticsRevenueRepositorySnapshot;
export type AdminAnalyticsAcquisitionSnapshot =
	AdminAnalyticsAcquisitionRepositorySnapshot;
export type AdminAnalyticsFunnelSnapshot =
	AdminAnalyticsFunnelRepositorySnapshot;
export type AdminAnalyticsEngagementSnapshot =
	AdminAnalyticsEngagementRepositorySnapshot;
export type AdminAnalyticsFeaturesSnapshot =
	AdminAnalyticsFeaturesRepositorySnapshot;
export type AdminAnalyticsHealthSnapshot =
	AdminAnalyticsHealthRepositorySnapshot;

@Injectable()
export class AdminAnalyticsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async getOverviewMetrics(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsOverviewMetricsRepositorySnapshot> {
		const [mrr, trialCohort] = await Promise.all([
			this.getMrr(client, input),
			this.getTrialCohort(client, input),
		]);

		return {
			activePaidUsers: mrr.activePaidUsers,
			mrrSubscriptions: mrr.subscriptions,
			healthyTrials: trialCohort.healthyTrials,
		};
	}

	async getAcquisition(
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters = {},
	): Promise<AdminAnalyticsAcquisitionRepositorySnapshot> {
		return this.db.transaction(async (transaction) => {
			const sources = await this.getAcquisitionSources(
				transaction,
				input,
				filters,
			);
			const campaigns = await this.getAcquisitionCampaigns(
				transaction,
				input,
				filters,
			);
			const countries = await this.getAcquisitionCountries(
				transaction,
				input,
				filters,
			);
			const costs = await this.getCostAllocation(transaction, input);

			return {
				costs,
				costsAttributionFiltered: hasAttributionFilters(filters),
				sources,
				campaigns,
				countries,
				unattributedSignups:
					sources.find(({ source }) => source === "unknown")?.signups ?? 0,
			};
		}, READ_ONLY_TRANSACTION);
	}

	async getFunnel(
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters = {},
	): Promise<AdminAnalyticsFunnelRepositorySnapshot> {
		return this.db.transaction(
			(transaction) => this.getFunnelSnapshot(transaction, input, filters),
			READ_ONLY_TRANSACTION,
		);
	}

	async getEngagement(
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters = {},
	): Promise<AdminAnalyticsEngagementRepositorySnapshot> {
		return this.db.transaction(async (transaction) => {
			const activity = await this.getEngagementActivity(
				transaction,
				input,
				filters,
			);
			const activityByDay = await this.getEngagementActivityByDay(
				transaction,
				input,
				filters,
			);
			const returning = await this.getEngagementReturning(
				transaction,
				input,
				filters,
			);
			const cohorts = await this.getEngagementCohorts(
				transaction,
				input,
				filters,
			);
			const healthyTrialsByDay = await this.getEngagementHealthyTrialsByDay(
				transaction,
				input,
				filters,
			);

			return {
				activity,
				activityByDay,
				returning,
				cohorts,
				healthyTrialsByDay,
			};
		}, READ_ONLY_TRANSACTION);
	}

	async getRevenue(
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsRevenueRepositorySnapshot> {
		return this.db.transaction(async (transaction) => {
			const mrr = await this.getMrr(transaction, input);
			const trialCohort = await this.getTrialCohort(transaction, input);
			const collectedRevenueByDay = await this.getCollectedRevenue(
				transaction,
				input,
			);
			const revenueBySource = await this.getRevenueBySource(transaction, input);
			const marginAfterAi = await this.getMarginAfterAi(transaction, input);
			const newPaidByDay = await this.getNewPaidByDay(transaction, input);
			const daysToConvert = await this.getDaysToConvert(transaction, input);
			const checkoutFunnel = await this.getCheckoutFunnel(transaction, input);
			const lifecycle = await this.getRevenueLifecycle(transaction, input);
			const paymentAdjustments = await this.getRevenuePaymentAdjustments(
				transaction,
				input,
			);
			const retention = await this.getRevenueRetention(transaction, input);
			const churnBreakdown = await this.getChurnBreakdown(transaction, input);
			const acquisitionSources = await this.getAcquisitionSources(
				transaction,
				input,
				{},
			);
			const creditRange = await this.getCreditRange(transaction, input);
			const funnel = await this.getFunnelSnapshot(transaction, input, {});
			const costs = await this.getCostAllocation(transaction, input);

			return {
				activePaidUsers: mrr.activePaidUsers,
				mrrSubscriptions: mrr.subscriptions,
				mrrPlanOwners: mrr.planOwners,
				daysInRange: selectedCalendarDays(input),
				newPaidUsersInRange: newPaidByDay.reduce(
					(sum, point) => sum + point.count,
					0,
				),
				cohortPaidUsers: acquisitionSources.reduce(
					(sum, source) => sum + source.paid,
					0,
				),
				costs,
				freeOwnersInRange: creditRange.freeOwnersInRange,
				healthyTrialsInRange: funnel.healthyTrials,
				paidOwnersInRange: creditRange.paidOwnersInRange,
				trialCohort,
				collectedRevenueByDay,
				revenueBySource,
				marginAfterAi,
				newPaidByDay,
				daysToConvert,
				checkoutFunnel,
				lifecycle,
				paymentAdjustments,
				retention,
				churnBreakdown,
			};
		}, READ_ONLY_TRANSACTION);
	}

	async getFeatures(
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsFeaturesRepositorySnapshot> {
		return this.db.transaction(async (transaction) => {
			const adoption = await this.getFeatureAdoption(transaction, input);
			const creditRange = await this.getCreditRange(transaction, input);
			const freeConsumption = await this.getFreeConsumption(transaction, input);
			const beforeUpgrade = await this.getCreditsBeforeUpgrade(
				transaction,
				input,
			);
			const freeCredits = await this.getFreeCredits(transaction, input);
			const conversionByCredits = await this.getConversionByCredits(
				transaction,
				input,
			);
			const ads = await this.getAdsFeatures(transaction, input);

			return {
				activeUsersInRange: adoption.activeUsersInRange,
				features: adoption.features,
				ads,
				credits: {
					...creditRange,
					freeConsumptionTotals: freeConsumption.totals,
					usersAtZeroBalance: freeConsumption.usersAtZeroBalance,
					...beforeUpgrade,
				},
				freeCredits,
				conversionByCredits,
			};
		}, READ_ONLY_TRANSACTION);
	}

	async getHealth(
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsHealthRepositorySnapshot> {
		return this.db.transaction(async (transaction) => {
			const generation = await this.getGenerationHealth(transaction, input);
			const topFailures = await this.getTopPageFailures(transaction, input);
			const creditsRefundedInRange = await this.getCreditsRefunded(
				transaction,
				input,
			);
			const webhooks = await this.getWebhookHealth(transaction, input);

			return {
				generation: generation.map((row) => ({
					...row,
					topFailures: row.key === "pages" ? topFailures : [],
				})),
				creditsRefundedInRange,
				webhooks,
			};
		}, READ_ONLY_TRANSACTION);
	}

	private async getAcquisitionSources(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsAcquisitionRepositorySnapshot["sources"]> {
		const result = await client.execute<AcquisitionSourceRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			classified_users as (${filteredUserCohort(filters)}),
			cohort as (
				select c.user_id, c.source
				from classified_users c
				cross join bounds b
				where c.created_at >= b.range_start
					and c.created_at < b.range_end
			),
			activated_attempt_users as (
				select c.user_id
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				inner join cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				inner join cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from media_generation_attempts a
				inner join projects p on p.id = a.project_id
				inner join cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				inner join cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from lead_scrape_attempts a
				inner join projects p on p.id = a.project_id
				inner join cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from connector_generation_attempts a
				inner join cohort c on c.user_id = a.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
			),
			activated_users as (
				select distinct a.user_id
				from activated_attempt_users a
			),
			paid_users as (
				select distinct c.user_id
				from cohort c
				inner join subscriptions s on s.user_id = c.user_id
				cross join bounds b
				where s.created_at < b.snapshot_end
			),
			source_cohort_totals as (
				select
					c.source,
					count(*)::bigint as signups,
					count(*) filter (where a.user_id is not null)::bigint as activated,
					count(*) filter (where p.user_id is not null)::bigint as paid
				from cohort c
				left join activated_users a on a.user_id = c.user_id
				left join paid_users p on p.user_id = c.user_id
				group by c.source
			),
			live_subscription_attribution as (
				select c.source, s.price_lookup_key
				from subscriptions s
				cross join bounds b
				left join organization_billing_customers obc
					on obc.organization_id = s.organization_id
				inner join classified_users c
					on c.user_id = ${attributionUserExpression("s", "obc")}
				where s.created_at < b.snapshot_end
					and s.status in (${liveSubscriptionStatusList()})
					-- Manual prices are negotiated offline; catalog USD would inflate MRR.
					and s.provider = 'stripe'
			),
			source_mrr as (
				select
					a.source,
					a.price_lookup_key,
					count(*)::bigint as live_subscriptions
				from live_subscription_attribution a
				group by a.source, a.price_lookup_key
			)
			select
				coalesce(c.source, m.source) as source,
				coalesce(c.signups, 0)::bigint as signups,
				coalesce(c.activated, 0)::bigint as activated,
				coalesce(c.paid, 0)::bigint as paid,
				m.price_lookup_key,
				coalesce(m.live_subscriptions, 0)::bigint as live_subscriptions
			from source_cohort_totals c
			full outer join source_mrr m on m.source = c.source
			order by coalesce(c.source, m.source), m.price_lookup_key
		`);

		const sources = new Map<
			string,
			AdminAnalyticsAcquisitionRepositorySnapshot["sources"][number]
		>();

		for (const row of result.rows) {
			const source = String(row.source);
			const entry = sources.get(source) ?? {
				source,
				signups: toNumber(row.signups),
				activated: toNumber(row.activated),
				paid: toNumber(row.paid),
				mrrSubscriptions: [],
			};

			if (row.price_lookup_key !== null) {
				entry.mrrSubscriptions.push({
					priceLookupKey: row.price_lookup_key,
					subscribers: toNumber(row.live_subscriptions),
				});
			}
			sources.set(source, entry);
		}

		return [...sources.values()];
	}

	private async getAcquisitionCampaigns(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsAcquisitionRepositorySnapshot["campaigns"]> {
		const result = await client.execute<AcquisitionCampaignRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			filtered_users as (${filteredUserCohort(filters)}),
			campaign_users as (
				select
					u.id as user_id,
					u.created_at,
					btrim(a.utm_campaign) as campaign,
					coalesce(nullif(lower(btrim(a.utm_source)), ''), 'unknown')
						as source
				from "user" u
				inner join filtered_users f on f.user_id = u.id
				inner join user_attributions a on a.user_id = u.id
				cross join bounds b
				where u.created_at < b.snapshot_end
					and nullif(btrim(a.utm_campaign), '') is not null
			),
			cohort as (
				select c.user_id, c.campaign, c.source
				from campaign_users c
				cross join bounds b
				where c.created_at >= b.range_start
					and c.created_at < b.range_end
			),
			paid_users as (
				select distinct c.user_id
				from cohort c
				inner join subscriptions s on s.user_id = c.user_id
				cross join bounds b
				where s.created_at < b.snapshot_end
			),
			campaign_cohort_totals as (
				select
					c.campaign,
					c.source,
					count(*)::bigint as signups,
					count(*) filter (where p.user_id is not null)::bigint as paid
				from cohort c
				left join paid_users p on p.user_id = c.user_id
				group by c.campaign, c.source
			),
			live_campaign_subscriptions as (
				select c.campaign, c.source, s.price_lookup_key
				from subscriptions s
				cross join bounds b
				left join organization_billing_customers obc
					on obc.organization_id = s.organization_id
				inner join campaign_users c
					on c.user_id = ${attributionUserExpression("s", "obc")}
				where s.created_at < b.snapshot_end
					and s.status in (${liveSubscriptionStatusList()})
					-- Manual prices are negotiated offline; catalog USD would inflate MRR.
					and s.provider = 'stripe'
			),
			campaign_mrr as (
				select
					c.campaign,
					c.source,
					c.price_lookup_key,
					count(*)::bigint as live_subscriptions
				from live_campaign_subscriptions c
				group by c.campaign, c.source, c.price_lookup_key
			)
			select
				coalesce(c.campaign, m.campaign) as campaign,
				coalesce(c.source, m.source) as source,
				coalesce(c.signups, 0)::bigint as signups,
				coalesce(c.paid, 0)::bigint as paid,
				m.price_lookup_key,
				coalesce(m.live_subscriptions, 0)::bigint as live_subscriptions
			from campaign_cohort_totals c
			full outer join campaign_mrr m
				on m.campaign = c.campaign and m.source = c.source
			order by
				coalesce(c.campaign, m.campaign),
				coalesce(c.source, m.source),
				m.price_lookup_key
		`);

		const campaigns = new Map<
			string,
			AdminAnalyticsAcquisitionRepositorySnapshot["campaigns"][number]
		>();

		for (const row of result.rows) {
			const campaign = String(row.campaign);
			const source = String(row.source);
			const key = `${campaign}\u0000${source}`;
			const entry = campaigns.get(key) ?? {
				campaign,
				source,
				signups: toNumber(row.signups),
				paid: toNumber(row.paid),
				mrrSubscriptions: [],
			};

			if (row.price_lookup_key !== null) {
				entry.mrrSubscriptions.push({
					priceLookupKey: row.price_lookup_key,
					subscribers: toNumber(row.live_subscriptions),
				});
			}
			campaigns.set(key, entry);
		}

		return [...campaigns.values()];
	}

	private async getAcquisitionCountries(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsAcquisitionRepositorySnapshot["countries"]> {
		const result = await client.execute<AcquisitionCountryRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			filtered_users as (${filteredUserCohort(filters)}),
			country_cohort as (
				select u.id as user_id, upper(btrim(a.country)) as country
				from "user" u
				inner join filtered_users f on f.user_id = u.id
				inner join user_attributions a on a.user_id = u.id
				cross join bounds b
				where u.created_at >= b.range_start
					and u.created_at < b.range_end
					and nullif(btrim(a.country), '') is not null
			),
			paid_users as (
				select distinct c.user_id
				from country_cohort c
				inner join subscriptions s on s.user_id = c.user_id
				cross join bounds b
				where s.created_at < b.snapshot_end
			),
			country_totals as (
				select
					c.country,
					count(*)::bigint as signups,
					count(*) filter (where p.user_id is not null)::bigint as paid
				from country_cohort c
				left join paid_users p on p.user_id = c.user_id
				group by c.country
			)
			select c.country, c.signups, c.paid
			from country_totals c
			order by c.signups desc, c.country
		`);

		return result.rows.map((row) => ({
			country: String(row.country),
			signups: toNumber(row.signups),
			paid: toNumber(row.paid),
		}));
	}

	private async getFunnelSnapshot(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsFunnelRepositorySnapshot> {
		const result = await client.execute<FunnelRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			filtered_users as (${filteredUserCohort(filters)}),
			tracked_clicks as (
				select c.created_at
				from story_link_clicks c
				cross join bounds b
				where c.created_at >= b.range_start
					and c.created_at < b.range_end
				union all
				select c.created_at
				from affiliate_clicks c
				cross join bounds b
				where c.created_at >= b.range_start
					and c.created_at < b.range_end
			),
			signup_cohort as (
				select u.id as user_id, u.created_at
				from "user" u
				inner join filtered_users f on f.user_id = u.id
				cross join bounds b
				where u.created_at >= b.range_start
					and u.created_at < b.range_end
			),
			first_action_attempts as (
				select c.user_id, e.created_at as action_at
				from signup_cohort c
				inner join ai_usage_events e
					on e.user_id = c.user_id and e.operation = 'chat'
				cross join bounds b
				where e.created_at < b.snapshot_end
				union all
				select c.user_id, p.created_at as action_at
				from signup_cohort c
				inner join projects p on p.user_id = c.user_id
				cross join bounds b
				where p.created_at < b.snapshot_end
			),
			first_action_users as (
				select a.user_id, min(a.action_at) as first_action_at
				from first_action_attempts a
				group by a.user_id
			),
			first_action_durations as (
				select extract(epoch from (a.first_action_at - c.created_at)) as seconds
				from first_action_users a
				inner join signup_cohort c on c.user_id = a.user_id
				where a.first_action_at >= c.created_at
			),
			activated_attempt_users as (
				select c.user_id, a.completed_at as generation_at
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				inner join signup_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id, a.completed_at as generation_at
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				inner join signup_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id, a.completed_at as generation_at
				from media_generation_attempts a
				inner join projects p on p.id = a.project_id
				inner join signup_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id, a.completed_at as generation_at
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				inner join signup_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id, a.completed_at as generation_at
				from lead_scrape_attempts a
				inner join projects p on p.id = a.project_id
				inner join signup_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id, a.completed_at as generation_at
				from connector_generation_attempts a
				inner join signup_cohort c on c.user_id = a.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
			),
			activated_users as (
				select distinct a.user_id
				from activated_attempt_users a
			),
			first_generation_users as (
				select a.user_id, min(a.generation_at) as first_generation_at
				from activated_attempt_users a
				cross join bounds b
				where a.generation_at is not null
					and a.generation_at < b.snapshot_end
				group by a.user_id
			),
			first_generation_durations as (
				select
					extract(epoch from (g.first_generation_at - c.created_at)) as seconds
				from first_generation_users g
				inner join signup_cohort c on c.user_id = g.user_id
				where g.first_generation_at >= c.created_at
			),
			paid_users as (
				select distinct c.user_id
				from signup_cohort c
				inner join subscriptions s on s.user_id = c.user_id
				cross join bounds b
				where s.created_at < b.snapshot_end
			),
			mature_signup_cohort as (
				select c.user_id, c.created_at
				from signup_cohort c
				cross join bounds b
				where c.created_at <= b.snapshot_end - interval '7 days'
			),
			credit_consumption as (
				select
					c.user_id,
					sum(-l.delta)::bigint as credits_consumed
				from mature_signup_cohort c
				inner join credit_ledger l on l.user_id = c.user_id
				where ${netConsumptionPredicate("l")}
					and l.created_at >= c.created_at
					and l.created_at < c.created_at + interval '7 days'
				group by c.user_id
			),
			attempt_usage_actors as (
				select distinct on (e.operation, e.attempt_ref)
					e.operation,
					e.attempt_ref,
					e.user_id,
					e.created_at
				from ai_usage_events e
				cross join bounds b
				where e.operation in (
					'page_build',
					'image',
					'video',
					'marketing',
					'lead_scrape'
				)
					and e.attempt_ref is not null
					and e.created_at < b.snapshot_end
				order by e.operation, e.attempt_ref, e.created_at desc
			),
			completed_generation_attempts as (
				select c.user_id
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'page_build'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join mature_signup_cohort c on c.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.completed_at >= c.created_at
					and a.completed_at < c.created_at + interval '7 days'
				union all
				select c.user_id
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'image'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join mature_signup_cohort c on c.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.created_at >= c.created_at
					and a.created_at < c.created_at + interval '7 days'
					and a.completed_at >= c.created_at
					and a.completed_at < c.created_at + interval '7 days'
				union all
				select c.user_id
				from media_generation_attempts a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'video'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join mature_signup_cohort c on c.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.created_at >= c.created_at
					and a.created_at < c.created_at + interval '7 days'
					and a.completed_at >= c.created_at
					and a.completed_at < c.created_at + interval '7 days'
				union all
				select c.user_id
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'marketing'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join mature_signup_cohort c on c.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.created_at >= c.created_at
					and a.created_at < c.created_at + interval '7 days'
					and a.completed_at >= c.created_at
					and a.completed_at < c.created_at + interval '7 days'
				union all
				select c.user_id
				from connector_generation_attempts a
				inner join mature_signup_cohort c on c.user_id = a.user_id
				where a.status = 'succeeded'
					and a.created_at >= c.created_at
					and a.created_at < c.created_at + interval '7 days'
					and a.completed_at >= c.created_at
					and a.completed_at < c.created_at + interval '7 days'
				union all
				select c.user_id
				from lead_scrape_attempts a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'lead_scrape'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join mature_signup_cohort c on c.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.created_at >= c.created_at
					and a.created_at < c.created_at + interval '7 days'
					and a.completed_at >= c.created_at
					and a.completed_at < c.created_at + interval '7 days'
			),
			completed_generations as (
				select a.user_id, count(*)::bigint as completed_generations
				from completed_generation_attempts a
				group by a.user_id
			),
				healthy_trial_users as (
				select c.user_id
				from mature_signup_cohort c
				left join paid_users p on p.user_id = c.user_id
				left join credit_consumption l on l.user_id = c.user_id
				left join completed_generations g on g.user_id = c.user_id
				where p.user_id is null
					and coalesce(l.credits_consumed, 0) >= ${HEALTHY_TRIAL_MIN_CENTI_CREDITS}
						and coalesce(g.completed_generations, 0) >= ${HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS}
			),
			pricing_viewed_users as (
				select distinct c.user_id
				from signup_cohort c
				inner join product_events e
					on e.user_id = c.user_id and e.kind = 'pricing_viewed'
				cross join bounds b
				where e.created_at < b.snapshot_end
			),
			upgrade_clicked_users as (
				select distinct c.user_id
				from signup_cohort c
				inner join product_events e
					on e.user_id = c.user_id and e.kind = 'upgrade_clicked'
				cross join bounds b
				where e.created_at < b.snapshot_end
			),
			checkout_users as (
				select distinct c.user_id
				from signup_cohort c
				inner join billing_checkout_attempts a
					on a.user_id = c.user_id and a.purpose = 'subscription'
				cross join bounds b
				where a.created_at < b.snapshot_end
			)
			select
				${
					hasAttributionFilters(filters)
						? sql`null::bigint`
						: sql`(select count(*) from tracked_clicks)::bigint`
				} as visitors,
				(select count(*) from signup_cohort)::bigint as signups,
				(select count(*) from first_action_users)::bigint as first_actions,
				(select count(*) from activated_users)::bigint as activated,
				(select count(*) from healthy_trial_users)::bigint as healthy_trials,
				(select count(*) from pricing_viewed_users)::bigint
					as pricing_viewed_users,
				(select count(*) from upgrade_clicked_users)::bigint
					as upgrade_clicked_users,
				(select count(*) from checkout_users)::bigint as checkout_started,
				(select count(*) from paid_users)::bigint as paid,
				round((
					select percentile_cont(0.5) within group (order by d.seconds)
					from first_action_durations d
				))::bigint as median_first_action_seconds,
				round((
					select avg(d.seconds)
					from first_action_durations d
				))::bigint as avg_first_action_seconds,
				(select count(*) from first_action_durations)::bigint
					as first_action_duration_users,
				round((
					select percentile_cont(0.5) within group (order by d.seconds)
					from first_generation_durations d
				))::bigint as median_first_generation_seconds,
				round((
					select avg(d.seconds)
					from first_generation_durations d
				))::bigint as avg_first_generation_seconds,
				(select count(*) from first_generation_durations)::bigint
					as first_generation_duration_users
		`);

		const row = result.rows[0];
		return {
			visitors: hasAttributionFilters(filters) ? null : toNumber(row?.visitors),
			signups: toNumber(row?.signups),
			firstActions: toNumber(row?.first_actions),
			activated: toNumber(row?.activated),
			healthyTrials: toNumber(row?.healthy_trials),
			pricingViewed: toNumber(row?.pricing_viewed_users),
			upgradeClicked: toNumber(row?.upgrade_clicked_users),
			checkoutStarted: toNumber(row?.checkout_started),
			paid: toNumber(row?.paid),
			durations: {
				signupToFirstAction: {
					medianSeconds: toNullableNumber(row?.median_first_action_seconds),
					avgSeconds: toNullableNumber(row?.avg_first_action_seconds),
					users: toNumber(row?.first_action_duration_users),
				},
				signupToFirstGeneration: {
					medianSeconds: toNullableNumber(row?.median_first_generation_seconds),
					avgSeconds: toNullableNumber(row?.avg_first_generation_seconds),
					users: toNumber(row?.first_generation_duration_users),
				},
			},
		};
	}

	private async getEngagementActivity(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsEngagementRepositorySnapshot["activity"]> {
		const result = await client.execute<EngagementActivityRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			filtered_users as (${filteredUserCohort(filters, {
				honorCohortOnly: true,
			})}),
			date_bounds as (
				select
					(b.range_start at time zone 'UTC')::date as range_start_date,
					(b.series_end at time zone 'UTC')::date as data_end_date,
					case
						when b.range_end < b.series_end + interval '1 day'
							then (b.series_end at time zone 'UTC')::date - 1
						else (b.series_end at time zone 'UTC')::date
					end as last_full_date
				from bounds b
			),
			activity_in_range as (
				select a.user_id, a.activity_date
				from user_activity_days a
				inner join filtered_users f on f.user_id = a.user_id
				cross join date_bounds d
				where a.activity_date >= d.range_start_date
					and a.activity_date <= d.data_end_date
			),
			range_active_users as (
				select distinct a.user_id
				from activity_in_range a
			),
			paid_active_users as (
				select distinct a.user_id
				from range_active_users a
				inner join subscriptions s on s.user_id = a.user_id
				cross join bounds b
				where s.created_at < b.snapshot_end
			),
			range_activity_totals as (
				select
					count(*)::bigint as active_days,
					count(distinct a.user_id)::bigint as active_users
				from activity_in_range a
			),
			activity_windows as (
				select
					count(distinct a.user_id) filter (
						where d.last_full_date >= d.range_start_date
							and a.activity_date = d.last_full_date
					)::bigint as dau,
					count(distinct a.user_id) filter (
						where a.activity_date >= d.data_end_date - 6
							and a.activity_date <= d.data_end_date
					)::bigint as wau,
					count(distinct a.user_id) filter (
						where a.activity_date >= d.data_end_date - 29
							and a.activity_date <= d.data_end_date
					)::bigint as mau
				from user_activity_days a
				inner join filtered_users f on f.user_id = a.user_id
				cross join date_bounds d
				where a.activity_date >= d.data_end_date - 29
					and a.activity_date <= d.data_end_date
			),
			active_free_trials as (
				select count(*)::bigint as active_free_trial_users
				from range_active_users a
				left join paid_active_users p on p.user_id = a.user_id
				where p.user_id is null
			),
			metered_actions as (
				select
					count(*)::bigint as actions,
					count(distinct e.user_id)::bigint as acting_users
				from ai_usage_events e
				inner join filtered_users f on f.user_id = e.user_id
				cross join bounds b
				where e.created_at >= b.range_start
					and e.created_at < b.range_end
					and e.operation <> 'topup_adjust'
			)
			select
				w.dau,
				w.wau,
				w.mau,
				r.active_days,
				r.active_users,
				f.active_free_trial_users,
				m.actions,
				m.acting_users
			from activity_windows w
			cross join range_activity_totals r
			cross join active_free_trials f
			cross join metered_actions m
		`);

		const row = result.rows[0];
		return {
			dau: toNumber(row?.dau),
			wau: toNumber(row?.wau),
			mau: toNumber(row?.mau),
			activeDays: toNumber(row?.active_days),
			activeUsers: toNumber(row?.active_users),
			activeFreeTrialUsers: toNumber(row?.active_free_trial_users),
			actions: toNumber(row?.actions),
			actingUsers: toNumber(row?.acting_users),
		};
	}

	private async getEngagementActivityByDay(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsEngagementRepositorySnapshot["activityByDay"]> {
		const result = await client.execute<EngagementActivityDayRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			filtered_users as (${filteredUserCohort(filters, {
				honorCohortOnly: true,
			})}),
			days as (
				select generate_series(
					b.range_start,
					b.series_end,
					interval '1 day'
				) as day
				from bounds b
			),
			daily_activity as (
				select a.activity_date, count(distinct a.user_id)::bigint as active_users
				from user_activity_days a
				inner join filtered_users f on f.user_id = a.user_id
				cross join bounds b
				where a.activity_date >= (b.range_start at time zone 'UTC')::date
					and a.activity_date <= (b.series_end at time zone 'UTC')::date
				group by a.activity_date
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(a.active_users, 0)::bigint as active_users
			from days d
			left join daily_activity a
				on a.activity_date = (d.day at time zone 'UTC')::date
			order by d.day
		`);

		return result.rows.map((row) => ({
			date: String(row.date),
			activeUsers: toNumber(row.active_users),
		}));
	}

	private async getEngagementReturning(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsEngagementRepositorySnapshot["returning"]> {
		// Day-X retention means activity on the exact UTC calendar date obtained by
		// adding X days to the user's UTC signup date; it is not a rolling window.
		const result = await client.execute<EngagementReturningRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			filtered_users as (${filteredUserCohort(filters, {
				honorCohortOnly: true,
			})}),
			offsets(day_offset) as (
				values (1), (3), (7), (14), (30)
			),
			date_bounds as (
				select (b.series_end at time zone 'UTC')::date as data_end_date
				from bounds b
			),
			signup_cohort as (
				select
					u.id as user_id,
					(u.created_at at time zone 'UTC')::date as signup_date
				from "user" u
				inner join filtered_users f on f.user_id = u.id
				cross join bounds b
				where u.created_at >= b.range_start
					and u.created_at < b.range_end
			),
			eligible_signups as (
				select c.user_id, c.signup_date, o.day_offset
				from signup_cohort c
				cross join offsets o
				cross join date_bounds d
				where c.signup_date + o.day_offset <= d.data_end_date
			),
			signup_retention as (
				select
					o.day_offset,
					count(e.user_id)::bigint as eligible_users,
					count(a.user_id)::bigint as returning_users
				from offsets o
				left join eligible_signups e on e.day_offset = o.day_offset
				left join user_activity_days a
					on a.user_id = e.user_id
					and a.activity_date = e.signup_date + e.day_offset
				group by o.day_offset
			)
			select r.day_offset, r.eligible_users, r.returning_users
			from signup_retention r
			order by r.day_offset
		`);

		return result.rows.flatMap((row) => {
			const day = toNumber(row.day_offset);
			if (!isRetentionDay(day)) return [];
			return [
				{
					day,
					eligibleUsers: toNumber(row.eligible_users),
					returningUsers: toNumber(row.returning_users),
				},
			];
		});
	}

	private async getEngagementCohorts(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsEngagementRepositorySnapshot["cohorts"]> {
		const result = await client.execute<EngagementCohortRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			filtered_users as (${filteredUserCohort(filters, {
				honorCohortOnly: true,
			})}),
			date_bounds as (
				select (b.series_end at time zone 'UTC')::date as data_end_date
				from bounds b
			),
			signup_cohort as (
				select
					u.id as user_id,
					date_trunc('week', u.created_at at time zone 'UTC')::date
						as cohort_week_start
				from "user" u
				inner join filtered_users f on f.user_id = u.id
				cross join bounds b
				where u.created_at >= b.range_start
					and u.created_at < b.range_end
			),
			cohort_sizes as (
				select
					c.cohort_week_start,
					count(*)::bigint as cohort_size
				from signup_cohort c
				group by c.cohort_week_start
			),
			cohort_grid as (
				select
					c.cohort_week_start,
					c.cohort_size,
					generated_week.week_index
				from cohort_sizes c
				cross join date_bounds d
				cross join lateral generate_series(
					0,
					greatest(
						0,
						floor((d.data_end_date - c.cohort_week_start) / 7.0)::int
					)
				) as generated_week(week_index)
			),
			weekly_activity as (
				select
					c.cohort_week_start,
					floor((a.activity_date - c.cohort_week_start) / 7.0)::int
						as week_index,
					count(distinct c.user_id)::bigint as active_users
				from signup_cohort c
				inner join user_activity_days a on a.user_id = c.user_id
				cross join date_bounds d
				where a.activity_date >= c.cohort_week_start
					and a.activity_date <= d.data_end_date
				group by c.cohort_week_start, week_index
			)
			select
				to_char(g.cohort_week_start, 'YYYY-MM-DD') as cohort_week_start,
				g.cohort_size,
				g.week_index,
				coalesce(a.active_users, 0)::bigint as active_users
			from cohort_grid g
			left join weekly_activity a
				on a.cohort_week_start = g.cohort_week_start
				and a.week_index = g.week_index
			order by g.cohort_week_start, g.week_index
		`);

		return result.rows.map((row) => ({
			cohortWeekStart: String(row.cohort_week_start),
			size: toNumber(row.cohort_size),
			weekIndex: toNumber(row.week_index),
			activeUsers: toNumber(row.active_users),
		}));
	}

	private async getEngagementHealthyTrialsByDay(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
		filters: AdminAnalyticsFilters,
	): Promise<AdminAnalyticsEngagementRepositorySnapshot["healthyTrialsByDay"]> {
		// Crossing timestamps are not materialized. A user who satisfies both
		// first-seven-day thresholds is therefore assigned to signup UTC date + 7.
		const result = await client.execute<EngagementHealthyTrialDayRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			filtered_users as (${filteredUserCohort(filters, {
				honorCohortOnly: true,
			})}),
			days as (
				select generate_series(
					b.range_start,
					b.series_end,
					interval '1 day'
				) as day
				from bounds b
			),
			evaluation_users as (
				select
					u.id as user_id,
					u.created_at,
					(u.created_at at time zone 'UTC')::date + 7 as evaluation_date
				from "user" u
				inner join filtered_users f on f.user_id = u.id
				cross join bounds b
				where u.created_at <= b.snapshot_end - interval '7 days'
					and (u.created_at at time zone 'UTC')::date + 7
						>= (b.range_start at time zone 'UTC')::date
					and (u.created_at at time zone 'UTC')::date + 7
						<= (b.series_end at time zone 'UTC')::date
			),
			paid_users as (
				select distinct u.user_id
				from evaluation_users u
				inner join subscriptions s on s.user_id = u.user_id
				cross join bounds b
				where s.created_at < b.snapshot_end
			),
			credit_consumption as (
				select
					u.user_id,
					sum(-c.delta)::bigint as credits_consumed
				from evaluation_users u
				inner join credit_ledger c on c.user_id = u.user_id
				where ${netConsumptionPredicate("c")}
					and c.created_at >= u.created_at
					and c.created_at < u.created_at + interval '7 days'
				group by u.user_id
			),
			attempt_usage_actors as (
				select distinct on (e.operation, e.attempt_ref)
					e.operation,
					e.attempt_ref,
					e.user_id,
					e.created_at
				from ai_usage_events e
				cross join bounds b
				where e.operation in (
					'page_build',
					'image',
					'video',
					'marketing',
					'lead_scrape'
				)
					and e.attempt_ref is not null
					and e.created_at < b.snapshot_end
				order by e.operation, e.attempt_ref, e.created_at desc
			),
			completed_generation_attempts as (
				select u.user_id
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'page_build'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join evaluation_users u on u.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.completed_at >= u.created_at
					and a.completed_at < u.created_at + interval '7 days'
				union all
				select u.user_id
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'image'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join evaluation_users u on u.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.created_at >= u.created_at
					and a.created_at < u.created_at + interval '7 days'
					and a.completed_at >= u.created_at
					and a.completed_at < u.created_at + interval '7 days'
				union all
				select u.user_id
				from media_generation_attempts a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'video'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join evaluation_users u on u.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.created_at >= u.created_at
					and a.created_at < u.created_at + interval '7 days'
					and a.completed_at >= u.created_at
					and a.completed_at < u.created_at + interval '7 days'
				union all
				select u.user_id
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'marketing'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join evaluation_users u on u.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.created_at >= u.created_at
					and a.created_at < u.created_at + interval '7 days'
					and a.completed_at >= u.created_at
					and a.completed_at < u.created_at + interval '7 days'
				union all
				select u.user_id
				from connector_generation_attempts a
				inner join evaluation_users u on u.user_id = a.user_id
				where a.status = 'succeeded'
					and a.created_at >= u.created_at
					and a.created_at < u.created_at + interval '7 days'
					and a.completed_at >= u.created_at
					and a.completed_at < u.created_at + interval '7 days'
				union all
				select u.user_id
				from lead_scrape_attempts a
				inner join projects p on p.id = a.project_id
				left join attempt_usage_actors usage_actor
					on usage_actor.operation = 'lead_scrape'
					and usage_actor.attempt_ref = a.id::text
					and usage_actor.created_at >= a.created_at
				inner join evaluation_users u on u.user_id = coalesce(
					usage_actor.user_id,
					case when p.organization_id is null then p.user_id end
				)
				where p.deleted_at is null
					and a.status = 'succeeded'
					and a.created_at >= u.created_at
					and a.created_at < u.created_at + interval '7 days'
					and a.completed_at >= u.created_at
					and a.completed_at < u.created_at + interval '7 days'
			),
			completed_generations as (
				select a.user_id, count(*)::bigint as completed_generations
				from completed_generation_attempts a
				group by a.user_id
			),
			healthy_evaluations as (
				select u.user_id, u.evaluation_date
				from evaluation_users u
				left join paid_users p on p.user_id = u.user_id
				left join credit_consumption c on c.user_id = u.user_id
				left join completed_generations g on g.user_id = u.user_id
				where p.user_id is null
					and coalesce(c.credits_consumed, 0) >= ${HEALTHY_TRIAL_MIN_CENTI_CREDITS}
					and coalesce(g.completed_generations, 0) >= ${HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS}
			),
			healthy_by_day as (
				select h.evaluation_date, count(*)::bigint as count
				from healthy_evaluations h
				group by h.evaluation_date
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(h.count, 0)::bigint as count
			from days d
			left join healthy_by_day h
				on h.evaluation_date = (d.day at time zone 'UTC')::date
			order by d.day
		`);

		return result.rows.map((row) => ({
			date: String(row.date),
			count: toNumber(row.count),
		}));
	}

	private async getMrr(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<RevenueMrrRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			live_subscriptions as (
				select
					s.plan,
					s.price_lookup_key,
					s.provider,
					coalesce(s.organization_id, s.user_id) as owner_id
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
					and s.status in (${liveSubscriptionStatusList()})
			),
			stripe_priced_subscriptions as (
				select l.plan, l.price_lookup_key, l.owner_id
				from live_subscriptions l
				-- Manual prices are negotiated offline; catalog USD would inflate MRR.
				where l.provider = 'stripe'
			),
			grouped as (
				select
					l.plan,
					l.price_lookup_key,
					count(*)::bigint as subscribers
				from stripe_priced_subscriptions l
				group by l.plan, l.price_lookup_key
			),
			plan_owner_totals as (
				select
					l.plan,
					count(distinct l.owner_id)::bigint as plan_owners
				from stripe_priced_subscriptions l
				group by l.plan
			),
			owner_totals as (
				select count(distinct l.owner_id)::bigint as active_paid_users
				from live_subscriptions l
			)
			select
				g.plan,
				g.price_lookup_key,
				coalesce(g.subscribers, 0)::bigint as subscribers,
				o.active_paid_users,
				coalesce(p.plan_owners, 0)::bigint as plan_owners
			from owner_totals o
			left join grouped g on true
			left join plan_owner_totals p on p.plan = g.plan
			order by g.plan, g.price_lookup_key
		`);

		const planOwners = new Map<BillingPlanId, number>();
		for (const row of result.rows) {
			if (row.plan !== null) {
				planOwners.set(row.plan, toNumber(row.plan_owners));
			}
		}

		return {
			activePaidUsers: toNumber(result.rows[0]?.active_paid_users),
			subscriptions: result.rows.flatMap((row) =>
				row.price_lookup_key === null
					? []
					: [
							{
								priceLookupKey: row.price_lookup_key,
								subscribers: toNumber(row.subscribers),
							},
						],
			),
			planOwners: [...planOwners].map(([plan, owners]) => ({ plan, owners })),
		};
	}

	private async getTrialCohort(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<TrialCohortRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			mature_users as (
				select u.id, u.created_at
				from "user" u
				cross join bounds b
				where u.created_at <= b.snapshot_end - interval '7 days'
			),
			first_subscriptions as (
				select s.user_id, min(s.created_at) as first_subscription_at
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
				group by s.user_id
			),
			credit_consumption as (
				select
					c.user_id,
					sum(-c.delta)::bigint as credits_consumed
				from credit_ledger c
				inner join mature_users u on u.id = c.user_id
				cross join bounds b
				where ${netConsumptionPredicate("c")}
					and c.created_at >= u.created_at
					and c.created_at < u.created_at + interval '7 days'
					and c.created_at < b.snapshot_end
				group by c.user_id
			),
			completed_generations as (
				select generation.user_id, count(*)::bigint as completed_generations
				from (
					-- Metering preserves the acting member for org work. A legacy or
					-- billing-off personal attempt can safely fall back to its sole owner;
					-- an unattributed org attempt cannot and is conservatively excluded.
					select coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					) as user_id
					from page_generation_attempts a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'page_build'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users u on u.id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.completed_at >= u.created_at
						and a.completed_at < u.created_at + interval '7 days'
						and a.completed_at < b.snapshot_end
					union all
					select coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					from image_generation_attempts a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'image'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users u on u.id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.created_at >= u.created_at
						and a.created_at < u.created_at + interval '7 days'
						and a.completed_at >= u.created_at
						and a.completed_at < u.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
					union all
					select coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					from media_generation_attempts a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'video'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users u on u.id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.created_at >= u.created_at
						and a.created_at < u.created_at + interval '7 days'
						and a.completed_at >= u.created_at
						and a.completed_at < u.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
					union all
					select coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					from marketing_assets a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'marketing'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users u on u.id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.created_at >= u.created_at
						and a.created_at < u.created_at + interval '7 days'
						and a.completed_at >= u.created_at
						and a.completed_at < u.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
					union all
					select a.user_id
					from connector_generation_attempts a
					inner join mature_users u on u.id = a.user_id
					cross join bounds b
					where a.status = 'succeeded'
						and a.created_at >= u.created_at
						and a.created_at < u.created_at + interval '7 days'
						and a.completed_at >= u.created_at
						and a.completed_at < u.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
					union all
					select coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					from lead_scrape_attempts a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'lead_scrape'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users u on u.id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.created_at >= u.created_at
						and a.created_at < u.created_at + interval '7 days'
						and a.completed_at >= u.created_at
						and a.completed_at < u.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
				) generation
				group by generation.user_id
			),
			cohort as (
				select
					u.id,
					(f.first_subscription_at is not null) as paid,
					(
						coalesce(c.credits_consumed, 0) >= ${HEALTHY_TRIAL_MIN_CENTI_CREDITS}
						and coalesce(g.completed_generations, 0) >= ${HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS}
					) as healthy
				from mature_users u
				left join first_subscriptions f on f.user_id = u.id
				left join credit_consumption c on c.user_id = u.id
				left join completed_generations g on g.user_id = u.id
			)
			select
				count(*)::bigint as mature_users,
				count(*) filter (where c.paid)::bigint as paid_users,
				count(*) filter (where not c.paid)::bigint as trials,
				count(*) filter (where not c.paid and c.healthy)::bigint as healthy_trials,
				count(*) filter (where c.healthy)::bigint as healthy_users,
				count(*) filter (where c.healthy and c.paid)::bigint as healthy_paid_users,
				count(*) filter (where not c.healthy)::bigint as non_healthy_users,
				count(*) filter (where not c.healthy and c.paid)::bigint as non_healthy_paid_users
			from cohort c
		`);

		const row = result.rows[0];

		return {
			matureUsers: toNumber(row?.mature_users),
			paidUsers: toNumber(row?.paid_users),
			trials: toNumber(row?.trials),
			healthyTrials: toNumber(row?.healthy_trials),
			healthyUsers: toNumber(row?.healthy_users),
			healthyPaidUsers: toNumber(row?.healthy_paid_users),
			nonHealthyUsers: toNumber(row?.non_healthy_users),
			nonHealthyPaidUsers: toNumber(row?.non_healthy_paid_users),
		};
	}

	private async getCollectedRevenue(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<CollectedRevenueRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			days as (
				select generate_series(
					b.range_start,
					b.series_end,
					interval '1 day'
				) as day
				from bounds b
			),
			subscription_revenue as (
				select
					(a.paid_at at time zone 'UTC')::date as day,
					sum(a.amount_paid_minor)::bigint as amount_minor
				from billing_invoice_applications a
				cross join bounds b
				where a.paid_at >= b.range_start
					and a.paid_at < b.range_end
					and a.amount_paid_minor > 0
					and lower(a.currency) = 'usd'
				group by 1
			),
			order_revenue as (
				select
					(o.paid_at at time zone 'UTC')::date as day,
					sum(o.amount_cents)::bigint as amount_minor
				from payment_orders o
				cross join bounds b
				where o.paid_at >= b.range_start
					and o.paid_at < b.range_end
					and o.status in ('paid', 'fulfilling', 'fulfilled')
					and lower(o.currency) = 'usd'
				group by 1
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(s.amount_minor, 0)::bigint as subscriptions_minor,
				coalesce(o.amount_minor, 0)::bigint as orders_minor
			from days d
			left join subscription_revenue s
				on s.day = (d.day at time zone 'UTC')::date
			left join order_revenue o
				on o.day = (d.day at time zone 'UTC')::date
			order by d.day asc
		`);

		return result.rows.map((row) => ({
			date: String(row.date),
			subscriptionsMinor: toNumber(row.subscriptions_minor),
			ordersMinor: toNumber(row.orders_minor),
		}));
	}

	// Range totals for the same cash the collected-revenue chart counts, split by
	// source, plus domain resale economics. Wholesale cost prefers the actual
	// registrar charge stored on the domain row and falls back to the
	// checkout-time wholesale quote; orders with neither contribute zero cost and
	// are surfaced via domain_cost_unknown_orders.
	private async getRevenueBySource(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<RevenueBySourceRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			subscription_totals as (
				select coalesce(sum(a.amount_paid_minor), 0)::bigint as amount_minor
				from billing_invoice_applications a
				cross join bounds b
				where a.paid_at >= b.range_start
					and a.paid_at < b.range_end
					and a.amount_paid_minor > 0
					and lower(a.currency) = 'usd'
			),
			domain_orders as (
				select
					o.amount_cents,
					coalesce(
						round(d.provider_total_paid_usd * 100),
						round((o.metadata -> 'priceSnapshot' ->> 'quotedWholesaleUsd')::numeric * 100)
					)::bigint as wholesale_cents
				from payment_orders o
				cross join bounds b
				left join lateral (
					select reg.provider_total_paid_usd
					from domains reg
					where reg.payment_order_id = o.id
					order by reg.created_at desc
					limit 1
				) d on true
				where o.paid_at >= b.range_start
					and o.paid_at < b.range_end
					and o.kind = 'domain_registration'
					and o.status in ('paid', 'fulfilling', 'fulfilled')
					and lower(o.currency) = 'usd'
			)
			select
				s.amount_minor as subscriptions_minor,
				coalesce((select sum(d.amount_cents) from domain_orders d), 0)::bigint as domains_minor,
				coalesce((select count(*) from domain_orders d), 0)::bigint as domain_orders,
				coalesce((select sum(d.wholesale_cents) from domain_orders d), 0)::bigint as domain_cost_cents,
				coalesce((select count(*) from domain_orders d where d.wholesale_cents is null), 0)::bigint as domain_cost_unknown_orders
			from subscription_totals s
		`);

		const row = result.rows[0];

		return {
			subscriptionsCents: toNumber(row?.subscriptions_minor),
			domainsCents: toNumber(row?.domains_minor),
			domainOrders: toNumber(row?.domain_orders),
			domainCostCents: toNumber(row?.domain_cost_cents),
			domainCostUnknownOrders: toNumber(row?.domain_cost_unknown_orders),
		};
	}

	// Margin after AI per plan — measured numbers only. Revenue is the same
	// collected subscription cash getRevenueBySource totals, attributed to the
	// plan of the invoiced subscription; invoice cash whose subscription row
	// resolves no plan is EXCLUDED from the split, so the per-plan revenues can
	// sum to less than revenueBySource.subscriptionsCents. Cost is the metered
	// provider spend of the plan's owners, where an owner is
	// organization_id ?? user_id and the plan is the owner's CURRENT live
	// subscription (subscriptions keep no plan history): both plans counts as
	// business, no live subscription counts as free.
	private async getMarginAfterAi(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<MarginAfterAiRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			plan_revenue as (
				select
					s.plan::text as plan,
					sum(a.amount_paid_minor)::bigint as revenue_cents
				from billing_invoice_applications a
				cross join bounds b
				left join subscriptions s on s.id = a.subscription_id
				where a.paid_at >= b.range_start
					and a.paid_at < b.range_end
					and a.amount_paid_minor > 0
					and lower(a.currency) = 'usd'
					and s.plan is not null
				group by 1
			),
			owner_plans as (
				select
					coalesce(s.organization_id, s.user_id) as owner_id,
					max(case when s.plan = 'business' then 2 else 1 end) as plan_rank
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
					and s.status in (${liveSubscriptionStatusList()})
				group by 1
			),
			owner_cost as (
				select
					coalesce(
						ai_usage_events.organization_id,
						ai_usage_events.user_id
					) as owner_id,
					sum(coalesce(${aiUsageEventCostUsdMicros}, 0))::bigint as cost_micros
				from ai_usage_events
				cross join bounds b
				where ai_usage_events.created_at >= b.range_start
					and ai_usage_events.created_at < b.range_end
					and ai_usage_events.status in (${aiSpendStatusList()})
				group by 1
			),
			plan_cost as (
				select
					case
						when o.plan_rank = 2 then 'business'
						when o.plan_rank = 1 then 'pro'
						else 'free'
					end as plan,
					round(sum(c.cost_micros)::numeric / 10000)::bigint as ai_cost_cents
				from owner_cost c
				left join owner_plans o on o.owner_id = c.owner_id
				group by 1
			)
			select
				coalesce(r.plan, c.plan) as plan,
				coalesce(r.revenue_cents, 0)::bigint as revenue_cents,
				coalesce(c.ai_cost_cents, 0)::bigint as ai_cost_cents
			from plan_revenue r
			full join plan_cost c on c.plan = r.plan
		`);

		return result.rows.map((row) => ({
			plan: String(row.plan),
			revenueCents: toNumber(row.revenue_cents),
			aiCostCents: toNumber(row.ai_cost_cents),
		}));
	}

	private async getNewPaidByDay(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<NewPaidRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			days as (
				select generate_series(
					b.range_start,
					b.series_end,
					interval '1 day'
				) as day
				from bounds b
			),
			first_subscriptions as (
				select s.user_id, min(s.created_at) as first_subscription_at
				from subscriptions s
				cross join bounds b
				where s.created_at < b.range_end
					and s.status in (${liveSubscriptionStatusList()})
				group by s.user_id
			),
			daily as (
				select
					(f.first_subscription_at at time zone 'UTC')::date as day,
					count(*)::bigint as count
				from first_subscriptions f
				cross join bounds b
				where f.first_subscription_at >= b.range_start
					and f.first_subscription_at < b.range_end
				group by 1
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(n.count, 0)::bigint as count
			from days d
			left join daily n on n.day = (d.day at time zone 'UTC')::date
			order by d.day asc
		`);

		return result.rows.map((row) => ({
			date: String(row.date),
			count: toNumber(row.count),
		}));
	}

	private async getDaysToConvert(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<DaysToConvertRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			first_subscriptions as (
				select s.user_id, min(s.created_at) as first_subscription_at
				from subscriptions s
				cross join bounds b
				where s.created_at < b.range_end
				group by s.user_id
			),
			conversion_days as (
				select greatest(
					0,
					floor(
						extract(epoch from (f.first_subscription_at - u.created_at)) / 86400
					)::int
				) as days
				from first_subscriptions f
				inner join "user" u on u.id = f.user_id
				cross join bounds b
				where f.first_subscription_at >= b.range_start
					and f.first_subscription_at < b.range_end
					and u.created_at < b.range_end
			)
			select c.days, count(*)::bigint as count
			from conversion_days c
			group by c.days
			order by c.days
		`);

		return result.rows.map((row) => ({
			days: toNumber(row.days),
			count: toNumber(row.count),
		}));
	}

	private async getCheckoutFunnel(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<CheckoutFunnelRow>(sql`
			with bounds as (${analyticsBounds(input)})
			select
				count(*)::bigint as started,
				count(*) filter (where a.status = 'completed')::bigint as completed
			from billing_checkout_attempts a
			cross join bounds b
			where a.created_at >= b.range_start
				and a.created_at < b.range_end
		`);

		const row = result.rows[0];

		return {
			started: toNumber(row?.started),
			completed: toNumber(row?.completed),
		};
	}

	private async getRevenueLifecycle(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsRevenueRepositorySnapshot["lifecycle"]> {
		const result = await client.execute<RevenueLifecycleRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			first_lookup_after_start as (
				select distinct on (e.stripe_subscription_id)
					e.stripe_subscription_id,
					e.from_lookup_key
				from subscription_state_events e
				cross join bounds b
				where e.occurred_at >= b.range_start
					and e.occurred_at < b.snapshot_end
					and e.from_lookup_key is not null
				order by e.stripe_subscription_id, e.occurred_at
			),
			ended_after_start as (
				select distinct e.stripe_subscription_id
				from subscription_state_events e
				cross join bounds b
				where e.kind = 'ended'
					and e.occurred_at >= b.range_start
					and e.occurred_at < b.snapshot_end
			),
			active_at_start_subscriptions as (
				select
					s.provider_subscription_id as stripe_subscription_id,
					coalesce(s.organization_id, s.user_id) as owner_id,
					coalesce(f.from_lookup_key, s.price_lookup_key) as price_lookup_key,
					s.provider
				from subscriptions s
				cross join bounds b
				left join first_lookup_after_start f
					on f.stripe_subscription_id = s.provider_subscription_id
				left join ended_after_start e
					on e.stripe_subscription_id = s.provider_subscription_id
				where s.created_at < b.range_start
					and (
						s.status in (${liveSubscriptionStatusList()})
						or e.stripe_subscription_id is not null
					)
			),
			active_at_start_summary as (
				select count(distinct a.owner_id)::bigint as active_paid_at_start
				from active_at_start_subscriptions a
			),
			mrr_at_start as (
				select
					a.price_lookup_key,
					count(*)::bigint as count
				from active_at_start_subscriptions a
				-- Manual prices are negotiated offline; catalog USD would inflate MRR.
				where a.provider = 'stripe'
				group by a.price_lookup_key
			),
			ended_in_range as (
				select distinct on (e.stripe_subscription_id)
					e.id as ended_state_event_id,
					e.stripe_subscription_id,
					coalesce(
						e.organization_id,
						s.organization_id,
						e.user_id,
						s.user_id
					) as owner_id,
					coalesce(e.from_lookup_key, s.price_lookup_key) as price_lookup_key,
					coalesce(
						s.provider,
						case
							when e.stripe_event_id like 'manual:%' then 'manual'
							else 'stripe'
						end
					) as provider
				from subscription_state_events e
				left join subscriptions s
					on s.provider_subscription_id = e.stripe_subscription_id
				cross join bounds b
				where e.kind = 'ended'
					and e.occurred_at >= b.range_start
					and e.occurred_at < b.range_end
					and coalesce(
						e.organization_id,
						s.organization_id,
						e.user_id,
						s.user_id
					) is not null
				order by e.stripe_subscription_id, e.occurred_at desc
			),
			ended_after_range_end as (
				select distinct e.stripe_subscription_id
				from subscription_state_events e
				cross join bounds b
				where e.kind = 'ended'
					and e.occurred_at >= b.range_end
					and e.occurred_at < b.snapshot_end
			),
			live_at_range_end_subscriptions as (
				select
					s.provider_subscription_id as stripe_subscription_id,
					coalesce(s.organization_id, s.user_id) as owner_id
				from subscriptions s
				cross join bounds b
				left join ended_after_range_end e
					on e.stripe_subscription_id = s.provider_subscription_id
				where s.created_at < b.range_end
					and (
						s.status in (${liveSubscriptionStatusList()})
						or e.stripe_subscription_id is not null
					)
			),
			churned_ended_subscriptions as (
				select
					e.stripe_subscription_id,
					e.owner_id,
					e.price_lookup_key,
					e.provider
				from ended_in_range e
				left join live_at_range_end_subscriptions l
					on l.owner_id = e.owner_id
					and l.stripe_subscription_id <> e.stripe_subscription_id
				where l.owner_id is null
			),
			churn_summary as (
				select count(distinct c.owner_id)::bigint as churned_owners
				from churned_ended_subscriptions c
			),
			churned_mrr as (
				select c.price_lookup_key, count(*)::bigint as count
				from churned_ended_subscriptions c
				-- Manual prices are negotiated offline; catalog USD would inflate MRR.
				where c.provider = 'stripe'
				group by c.price_lookup_key
			),
			created_events as (
				select e.to_lookup_key as price_lookup_key, count(*)::bigint as count
				from subscription_state_events e
				left join subscriptions s
					on s.provider_subscription_id = e.stripe_subscription_id
				cross join bounds b
				where e.kind = 'created'
					and e.occurred_at >= b.range_start
					and e.occurred_at < b.range_end
					-- Manual prices are negotiated offline; catalog USD would inflate MRR.
					and coalesce(
						s.provider,
						case
							when e.stripe_event_id like 'manual:%' then 'manual'
							else 'stripe'
						end
					) = 'stripe'
				group by e.to_lookup_key
			),
			plan_change_events as (
				select
					e.from_lookup_key,
					e.to_lookup_key,
					count(*)::bigint as count
				from subscription_state_events e
				left join subscriptions s
					on s.provider_subscription_id = e.stripe_subscription_id
				cross join bounds b
				where e.kind = 'plan_changed'
					and e.occurred_at >= b.range_start
					and e.occurred_at < b.range_end
					-- Manual prices are negotiated offline; catalog USD would inflate MRR.
					and coalesce(
						s.provider,
						case
							when e.stripe_event_id like 'manual:%' then 'manual'
							else 'stripe'
						end
					) = 'stripe'
				group by e.from_lookup_key, e.to_lookup_key
			),
			lifecycle_rows as (
				select
					'summary'::text as row_kind,
					null::text as price_lookup_key,
					null::text as from_lookup_key,
					null::text as to_lookup_key,
					0::bigint as count,
					a.active_paid_at_start,
					c.churned_owners
				from active_at_start_summary a
				cross join churn_summary c
				union all
				select
					'mrr_at_start',
					m.price_lookup_key,
					null::text,
					null::text,
					m.count,
					0::bigint,
					0::bigint
				from mrr_at_start m
				union all
				select
					'churned',
					c.price_lookup_key,
					null::text,
					null::text,
					c.count,
					0::bigint,
					0::bigint
				from churned_mrr c
				union all
				select
					'created',
					c.price_lookup_key,
					null::text,
					null::text,
					c.count,
					0::bigint,
					0::bigint
				from created_events c
				union all
				select
					'plan_changed',
					null::text,
					p.from_lookup_key,
					p.to_lookup_key,
					p.count,
					0::bigint,
					0::bigint
				from plan_change_events p
			)
			select
				r.row_kind,
				r.price_lookup_key,
				r.from_lookup_key,
				r.to_lookup_key,
				r.count,
				r.active_paid_at_start,
				r.churned_owners
			from lifecycle_rows r
			order by r.row_kind, r.price_lookup_key, r.from_lookup_key, r.to_lookup_key
		`);

		const summary = result.rows.find(({ row_kind }) => row_kind === "summary");
		return {
			activePaidOwnersAtStart: toNumber(summary?.active_paid_at_start),
			churnedOwners: toNumber(summary?.churned_owners),
			mrrAtStartSubscriptions: lifecycleSubscriptionRows(
				result.rows,
				"mrr_at_start",
			),
			churnedSubscriptions: lifecycleSubscriptionRows(result.rows, "churned"),
			createdSubscriptions: lifecycleSubscriptionRows(result.rows, "created"),
			planChanges: result.rows
				.filter(({ row_kind }) => row_kind === "plan_changed")
				.map((row) => ({
					count: toNumber(row.count),
					fromLookupKey: row.from_lookup_key,
					toLookupKey: row.to_lookup_key,
				})),
		};
	}

	private async getRevenueRetention(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsRevenueRepositorySnapshot["retention"]> {
		const result = await client.execute<RetentionRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			month_offsets(month_index) as (
				values (0), (1), (2), (3), (4), (5),
					(6), (7), (8), (9), (10), (11)
			),
			resolved_retention_events as (
				select
					e.id,
					e.stripe_subscription_id,
					coalesce(
						s.provider,
						case
							when e.stripe_event_id like 'manual:%' then 'manual'
							else 'stripe'
						end
					) as provider,
					e.kind,
					e.occurred_at,
					e.to_status,
					e.to_lookup_key,
					coalesce(
						e.organization_id,
						s.organization_id,
						e.user_id,
						s.user_id
					) as owner_id,
					s.status as current_status,
					s.price_lookup_key as current_lookup_key,
					s.created_at as subscription_created_at
				from subscription_state_events e
				left join subscriptions s
					on s.provider_subscription_id = e.stripe_subscription_id
				cross join bounds b
				where e.occurred_at <= b.snapshot_end
					and coalesce(
						e.organization_id,
						s.organization_id,
						e.user_id,
						s.user_id
					) is not null
			),
			subscription_created_events as (
				select distinct on (e.stripe_subscription_id)
					e.stripe_subscription_id,
					e.provider,
					e.owner_id,
					e.occurred_at as created_at,
					e.to_lookup_key as created_lookup_key,
					e.current_status,
					e.current_lookup_key,
					e.subscription_created_at
				from resolved_retention_events e
				where e.kind = 'created'
				order by e.stripe_subscription_id, e.occurred_at, e.id
			),
			subscription_event_owners as (
				select distinct on (e.stripe_subscription_id)
					e.stripe_subscription_id,
					e.provider,
					e.owner_id
				from resolved_retention_events e
				order by
					e.stripe_subscription_id,
					(e.kind = 'created') desc,
					e.occurred_at,
					e.id
			),
			retention_subscription_ids as (
				select s.provider_subscription_id as stripe_subscription_id
				from subscriptions s
				cross join bounds b
				where s.created_at <= b.snapshot_end
				union
				select e.stripe_subscription_id
				from resolved_retention_events e
			),
			retention_subscriptions as (
				select
					i.stripe_subscription_id,
					coalesce(s.provider, o.provider, c.provider) as provider,
					coalesce(o.owner_id, s.organization_id, s.user_id) as owner_id,
					c.created_at,
					c.created_lookup_key,
					s.status as current_status,
					s.price_lookup_key as current_lookup_key,
					s.created_at as subscription_created_at
				from retention_subscription_ids i
				left join subscriptions s
					on s.provider_subscription_id = i.stripe_subscription_id
				left join subscription_event_owners o
					on o.stripe_subscription_id = i.stripe_subscription_id
				left join subscription_created_events c
					on c.stripe_subscription_id = i.stripe_subscription_id
				where coalesce(o.owner_id, s.organization_id, s.user_id) is not null
			),
			owner_first_created as (
				select
					e.owner_id,
					min(e.created_at) as first_created_at
				from subscription_created_events e
				group by e.owner_id
			),
			owner_cohorts as (
				select
					o.owner_id,
					date_trunc('month', o.first_created_at at time zone 'UTC')::date
						as cohort_month
				from owner_first_created o
				where date_trunc('month', o.first_created_at at time zone 'UTC')::date
					>= date '2026-07-01'
			),
			cohort_sizes as (
				select c.cohort_month, count(*)::bigint as owners
				from owner_cohorts c
				group by c.cohort_month
			),
			cohort_boundaries as (
				select
					c.owner_id,
					c.cohort_month,
					o.month_index,
					(
						c.cohort_month::timestamp
							+ (o.month_index + 1) * interval '1 month'
					) at time zone 'UTC' as boundary_at
				from owner_cohorts c
				cross join month_offsets o
				cross join bounds b
				where (
					c.cohort_month::timestamp
						+ (o.month_index + 1) * interval '1 month'
				) at time zone 'UTC' <= b.snapshot_end
			),
			boundary_subscription_history as (
				select
					b.owner_id,
					b.cohort_month,
					b.month_index,
					s.stripe_subscription_id,
					s.provider,
					case
						when ended.id is not null then 'ended'
						else coalesce(history_status.to_status, s.current_status)
					end as effective_status,
					coalesce(
						history_lookup.to_lookup_key,
						s.created_lookup_key,
						case
							when history_status.to_status is null
								then s.current_lookup_key
						end
					) as effective_lookup_key
				from cohort_boundaries b
				left join retention_subscriptions s
					on s.owner_id = b.owner_id
					and coalesce(s.created_at, s.subscription_created_at) <= b.boundary_at
				left join lateral (
					select e.id
					from resolved_retention_events e
					where e.stripe_subscription_id = s.stripe_subscription_id
						and e.kind = 'ended'
						and e.occurred_at <= b.boundary_at
					order by e.occurred_at desc, e.id desc
					limit 1
				) ended on true
				left join lateral (
					select e.to_status
					from resolved_retention_events e
					where e.stripe_subscription_id = s.stripe_subscription_id
						and e.to_status is not null
						and e.occurred_at <= b.boundary_at
					order by e.occurred_at desc, e.id desc
					limit 1
				) history_status on true
				left join lateral (
					select e.to_lookup_key
					from resolved_retention_events e
					where e.stripe_subscription_id = s.stripe_subscription_id
						and e.to_lookup_key is not null
						and e.occurred_at <= b.boundary_at
					order by e.occurred_at desc, e.id desc
					limit 1
				) history_lookup on true
			),
			retention_paid_owners as (
				select
					h.cohort_month,
					h.month_index,
					count(distinct h.owner_id) filter (
						where h.effective_status in (${liveSubscriptionStatusList()})
					)::bigint as paid_owners
				from boundary_subscription_history h
				group by h.cohort_month, h.month_index
			),
			retention_lookup_totals as (
				select
					h.cohort_month,
					h.month_index,
					h.effective_lookup_key as price_lookup_key,
					count(h.stripe_subscription_id)::bigint as live_subscriptions
				from boundary_subscription_history h
				where h.effective_status in (${liveSubscriptionStatusList()})
					-- Manual prices are negotiated offline; catalog USD would inflate MRR.
					and h.provider = 'stripe'
				group by h.cohort_month, h.month_index, h.effective_lookup_key
			),
			retention_point_grid as (
				select distinct b.cohort_month, b.month_index
				from cohort_boundaries b
			)
			select
				to_char(g.cohort_month, 'YYYY-MM-DD') as cohort_month,
				c.owners,
				g.month_index,
				coalesce(p.paid_owners, 0)::bigint as paid_owners,
				l.price_lookup_key,
				coalesce(l.live_subscriptions, 0)::bigint as live_subscriptions
			from retention_point_grid g
			inner join cohort_sizes c on c.cohort_month = g.cohort_month
			left join retention_paid_owners p
				on p.cohort_month = g.cohort_month
				and p.month_index = g.month_index
			left join retention_lookup_totals l
				on l.cohort_month = g.cohort_month
				and l.month_index = g.month_index
			order by g.cohort_month, g.month_index, l.price_lookup_key
		`);

		const cohorts = new Map<
			string,
			AdminAnalyticsRevenueRepositorySnapshot["retention"]["cohorts"][number]
		>();

		for (const row of result.rows) {
			const cohortMonth = String(row.cohort_month);
			const cohort = cohorts.get(cohortMonth) ?? {
				cohortMonth,
				owners: toNumber(row.owners),
				points: [],
			};
			const monthIndex = toNumber(row.month_index);
			let point = cohort.points.find(
				(candidate) => candidate.monthIndex === monthIndex,
			);
			if (!point) {
				point = {
					monthIndex,
					paidOwners: toNumber(row.paid_owners),
					mrrSubscriptions: [],
				};
				cohort.points.push(point);
			}

			if (row.price_lookup_key !== null) {
				point.mrrSubscriptions.push({
					priceLookupKey: row.price_lookup_key,
					subscriptions: toNumber(row.live_subscriptions),
				});
			}
			cohorts.set(cohortMonth, cohort);
		}

		return {
			cohorts: [...cohorts.values()].map((cohort) => ({
				...cohort,
				points: cohort.points.sort(
					(left, right) => left.monthIndex - right.monthIndex,
				),
			})),
		};
	}

	private async getChurnBreakdown(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsRevenueRepositorySnapshot["churnBreakdown"]> {
		const result = await client.execute<ChurnBreakdownRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			ended_in_range as (
				select distinct on (e.stripe_subscription_id)
					e.id as ended_state_event_id,
					e.stripe_subscription_id,
					coalesce(
						s.provider,
						case
							when e.stripe_event_id like 'manual:%' then 'manual'
							else 'stripe'
						end
					) as provider,
					coalesce(
						e.organization_id,
						s.organization_id,
						e.user_id,
						s.user_id
					) as owner_id,
					coalesce(e.organization_id, s.organization_id) as organization_id,
					coalesce(e.user_id, s.user_id) as user_id,
					coalesce(e.from_lookup_key, s.price_lookup_key) as price_lookup_key,
					e.occurred_at as churned_at,
					coalesce(r.reason::text, 'unknown') as reason
				from subscription_state_events e
				left join subscriptions s
					on s.provider_subscription_id = e.stripe_subscription_id
				left join cancellation_reasons r
					on r.ended_state_event_id = e.id
				cross join bounds b
				where e.kind = 'ended'
					and e.occurred_at >= b.range_start
					and e.occurred_at < b.range_end
					and coalesce(
						e.organization_id,
						s.organization_id,
						e.user_id,
						s.user_id
					) is not null
				order by e.stripe_subscription_id, e.occurred_at desc
			),
			ended_after_range_end as (
				select distinct e.stripe_subscription_id
				from subscription_state_events e
				cross join bounds b
				where e.kind = 'ended'
					and e.occurred_at >= b.range_end
					and e.occurred_at < b.snapshot_end
			),
			live_at_range_end_subscriptions as (
				select
					s.provider_subscription_id as stripe_subscription_id,
					coalesce(s.organization_id, s.user_id) as owner_id
				from subscriptions s
				cross join bounds b
				left join ended_after_range_end e
					on e.stripe_subscription_id = s.provider_subscription_id
				where s.created_at < b.range_end
					and (
						s.status in (${liveSubscriptionStatusList()})
						or e.stripe_subscription_id is not null
					)
			),
			churned_ended_subscriptions as (
				select
					e.ended_state_event_id,
					e.stripe_subscription_id,
					e.provider,
					e.owner_id,
					e.organization_id,
					e.user_id,
					e.price_lookup_key,
					e.churned_at,
					e.reason
				from ended_in_range e
				left join live_at_range_end_subscriptions l
					on l.owner_id = e.owner_id
					and l.stripe_subscription_id <> e.stripe_subscription_id
				where l.owner_id is null
			),
			churned_owners as (
				select distinct on (c.owner_id)
					c.owner_id,
					c.organization_id,
					c.user_id,
					c.churned_at
				from churned_ended_subscriptions c
				order by c.owner_id, c.churned_at desc
			),
			churn_plan_rows as (
				select
					c.owner_id,
					c.provider,
					c.price_lookup_key,
					${churnPlanExpression(sql`c.price_lookup_key`)} as plan
				from churned_ended_subscriptions c
			),
			churn_plan_owners as (
				select p.plan, count(distinct p.owner_id)::bigint as churned
				from churn_plan_rows p
				group by p.plan
			),
			churn_plan_subscriptions as (
				select
					p.plan,
					p.price_lookup_key,
					count(*)::bigint as subscriptions
				from churn_plan_rows p
				-- Manual prices are negotiated offline; catalog USD would inflate MRR.
				where p.provider = 'stripe'
				group by p.plan, p.price_lookup_key
			),
			churn_attribution_users as (
				select
					c.owner_id,
					${attributionUserExpression("c", "obc")} as attribution_user_id
				from churned_owners c
				left join organization_billing_customers obc
					on obc.organization_id = c.organization_id
			),
			classified_churn_owners as (
				select
					c.owner_id,
					${acquisitionSourceExpression("aa", "ua")} as source,
					coalesce(nullif(upper(btrim(ua.country)), ''), 'unknown')
						as country
				from churn_attribution_users c
				left join affiliate_attributions aa
					on aa.user_id = c.attribution_user_id
				left join user_attributions ua
					on ua.user_id = c.attribution_user_id
			),
			churn_source_totals as (
				select c.source, count(distinct c.owner_id)::bigint as churned
				from classified_churn_owners c
				group by c.source
			),
			churn_country_totals as (
				select c.country, count(distinct c.owner_id)::bigint as churned
				from classified_churn_owners c
				group by c.country
			),
			churn_reason_totals as (
				select c.reason, count(distinct c.owner_id)::bigint as churned
				from churned_ended_subscriptions c
				group by c.reason
			),
			churn_usage_events as (
				select
					'websites'::text as feature,
					coalesce(p.organization_id, p.user_id) as owner_id,
					a.completed_at as event_at
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				where p.deleted_at is null
					and (a.spec ->> 'pageKind') is distinct from 'cod'
				union all
				select
					'landingPages',
					coalesce(p.organization_id, p.user_id),
					a.completed_at
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				where p.deleted_at is null
					and (a.spec ->> 'pageKind') = 'cod'
				union all
				select 'images', coalesce(p.organization_id, p.user_id), a.created_at
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				where p.deleted_at is null
				union all
				select 'videos', coalesce(p.organization_id, p.user_id), a.created_at
				from media_generation_attempts a
				inner join projects p on p.id = a.project_id
				where p.deleted_at is null
				union all
				select 'marketing', coalesce(p.organization_id, p.user_id), a.created_at
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				where p.deleted_at is null
				union all
				select 'connectors', coalesce(a.organization_id, a.user_id), a.created_at
				from connector_generation_attempts a
				union all
				select 'leadScraping', coalesce(p.organization_id, p.user_id), a.created_at
				from lead_scrape_attempts a
				inner join projects p on p.id = a.project_id
				where p.deleted_at is null
				union all
				select 'chat', coalesce(e.organization_id, e.user_id), e.created_at
				from ai_usage_events e
				where e.operation = 'chat'
				union all
				select 'publishing', coalesce(p.organization_id, p.user_id), d.created_at
				from deployments d
				inner join projects p on p.id = d.project_id
				where p.deleted_at is null
				union all
				select 'domains', coalesce(p.organization_id, d.user_id), d.created_at
				from domains d
				left join projects p on p.id = d.project_id
				where d.project_id is null or p.deleted_at is null
			),
			churn_feature_owners as (
				select distinct e.feature, c.owner_id
				from churn_usage_events e
				inner join churned_owners c
					on c.owner_id = e.owner_id
					and e.event_at < c.churned_at
			),
			churn_feature_totals as (
				select f.feature, count(*)::bigint as churned
				from churn_feature_owners f
				group by f.feature
			),
			breakdown_rows as (
				select
					'plan'::text as row_kind,
					o.plan as dimension,
					o.churned,
					p.price_lookup_key,
					coalesce(p.subscriptions, 0)::bigint as subscriptions
				from churn_plan_owners o
				left join churn_plan_subscriptions p on p.plan = o.plan
				union all
				select 'source', s.source, s.churned, null::text, 0::bigint
				from churn_source_totals s
				union all
				select 'reason', r.reason, r.churned, null::text, 0::bigint
				from churn_reason_totals r
				union all
				select 'country', c.country, c.churned, null::text, 0::bigint
				from churn_country_totals c
				union all
				select 'feature', f.feature, f.churned, null::text, 0::bigint
				from churn_feature_totals f
			)
			select
				b.row_kind,
				b.dimension,
				b.churned,
				b.price_lookup_key,
				b.subscriptions
			from breakdown_rows b
			order by b.churned desc, b.dimension, b.price_lookup_key
		`);

		const plans = new Map<
			string,
			AdminAnalyticsRevenueRepositorySnapshot["churnBreakdown"]["byPlan"][number]
		>();
		const bySource: AdminAnalyticsRevenueRepositorySnapshot["churnBreakdown"]["bySource"] =
			[];
		const byReason: AdminAnalyticsRevenueRepositorySnapshot["churnBreakdown"]["byReason"] =
			[];
		const byCountry: AdminAnalyticsRevenueRepositorySnapshot["churnBreakdown"]["byCountry"] =
			[];
		const byFeature: AdminAnalyticsRevenueRepositorySnapshot["churnBreakdown"]["byFeature"] =
			[];

		for (const row of result.rows) {
			if (row.row_kind === "plan") {
				const plan = plans.get(row.dimension) ?? {
					plan: row.dimension,
					churned: toNumber(row.churned),
					mrrSubscriptions: [],
				};
				if (row.price_lookup_key !== null) {
					plan.mrrSubscriptions.push({
						priceLookupKey: row.price_lookup_key,
						subscriptions: toNumber(row.subscriptions),
					});
				}
				plans.set(row.dimension, plan);
				continue;
			}

			if (row.row_kind === "source") {
				bySource.push({
					source: row.dimension || "unknown",
					churned: toNumber(row.churned),
				});
				continue;
			}

			if (row.row_kind === "reason") {
				byReason.push({
					reason: cancellationReason(row.dimension),
					churned: toNumber(row.churned),
				});
				continue;
			}

			if (row.row_kind === "country") {
				byCountry.push({
					country: row.dimension || "unknown",
					churned: toNumber(row.churned),
				});
				continue;
			}

			if (isAdminAnalyticsFeatureKey(row.dimension)) {
				byFeature.push({
					feature: row.dimension,
					churned: toNumber(row.churned),
				});
			}
		}

		return {
			byPlan: [...plans.values()],
			bySource,
			byReason,
			byCountry,
			byFeature,
		};
	}

	private async getRevenuePaymentAdjustments(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsRevenueRepositorySnapshot["paymentAdjustments"]> {
		const result = await client.execute<RevenuePaymentAdjustmentsRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			adjustment_totals as (
				select
					coalesce(sum(a.amount_cents) filter (
						where a.kind = 'refund' and lower(a.currency) = 'usd'
					), 0)::bigint as refunds_cents,
					count(*) filter (
						where a.kind = 'failed_payment' and lower(a.currency) = 'usd'
					)::bigint as failed_payments,
					coalesce(sum(a.amount_cents) filter (
						where a.kind = 'failed_payment' and lower(a.currency) = 'usd'
					), 0)::bigint as failed_payments_cents
				from billing_payment_adjustments a
				cross join bounds b
				where a.occurred_at >= b.range_start
					and a.occurred_at < b.range_end
			)
			select a.refunds_cents, a.failed_payments, a.failed_payments_cents
			from adjustment_totals a
		`);

		const row = result.rows[0];
		return {
			refundsCents: toNumber(row?.refunds_cents),
			failedPayments: toNumber(row?.failed_payments),
			failedPaymentsCents: toNumber(row?.failed_payments_cents),
		};
	}

	private async getCostAllocation(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminCostAllocation> {
		const result = await client.execute<MonthlyCostAllocationDbRow>(sql`
			with bounds as (${analyticsBounds(input)})
			select
				c.month::text as month,
				c.ad_spend_by_source_cents,
				c.infrastructure_cost_cents,
				c.other_cost_cents
			from monthly_costs c
			cross join bounds b
			where c.month <= (
				(b.range_end - interval '1 microsecond') at time zone 'UTC'
			)::date
				and c.month + interval '1 month' >
					(b.range_start at time zone 'UTC')::date
			order by c.month
		`);

		return prorateMonthlyCosts(
			result.rows.map((row) => ({
				month: row.month.slice(0, 10),
				adSpendBySourceCents: validCostRecord(row.ad_spend_by_source_cents),
				infrastructureCostCents: toNumber(row.infrastructure_cost_cents),
				otherCostCents: toNumber(row.other_cost_cents),
			})),
			input.rangeStart,
			input.rangeEnd,
		);
	}

	private async getAdsFeatures(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsFeaturesRepositorySnapshot["ads"]> {
		const result = await client.execute<AdsFeatureRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			operation_totals as (
				select
					count(*) filter (
						where e.feature = 'ads_analysis' and e.status = 'succeeded'
					)::bigint as analysis_succeeded,
					count(distinct e.user_id) filter (
						where e.feature = 'ads_analysis' and e.status = 'succeeded'
					)::bigint as analysis_users,
					count(*) filter (
						where e.feature = 'ads_analysis' and e.status = 'failed'
					)::bigint as analysis_failed,
					count(*) filter (
						where e.feature = 'ads_launch' and e.status = 'succeeded'
					)::bigint as launch_succeeded,
					count(distinct e.user_id) filter (
						where e.feature = 'ads_launch' and e.status = 'succeeded'
					)::bigint as launch_users,
					count(*) filter (
						where e.feature = 'ads_launch' and e.status = 'failed'
					)::bigint as launch_failed
				from connector_operation_events e
				cross join bounds b
				where e.created_at >= b.range_start
					and e.created_at < b.range_end
			),
			connected_users as (
				select count(distinct mc.user_id)::bigint as count
				from mcp_connections mc
				inner join mcp_connectors c on c.id = mc.connector_id
				cross join bounds b
				where c.enabled = true
					and c.slug in ('meta-ads', 'tiktok-ads')
					and mc.access_token is not null
					and (
						mc.access_token_expires_at is null
						or mc.access_token_expires_at >= b.snapshot_end
						or mc.refresh_token is not null
					)
			),
			total_users as (
				select count(*)::bigint as count
				from "user" u
				cross join bounds b
				where u.created_at < b.snapshot_end
			)
			select
				o.analysis_succeeded,
				o.analysis_users,
				o.analysis_failed,
				o.launch_succeeded,
				o.launch_users,
				o.launch_failed,
				c.count as connected_users,
				u.count as total_users
			from operation_totals o
			cross join connected_users c
			cross join total_users u
		`);

		const row = result.rows[0];
		return {
			analysis: {
				events: toNumber(row?.analysis_succeeded),
				failed: toNumber(row?.analysis_failed),
				users: toNumber(row?.analysis_users),
			},
			launch: {
				events: toNumber(row?.launch_succeeded),
				failed: toNumber(row?.launch_failed),
				users: toNumber(row?.launch_users),
			},
			connectedUsers: toNumber(row?.connected_users),
			totalUsers: toNumber(row?.total_users),
		};
	}

	private async getFeatureAdoption(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<FeatureAdoptionRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			live_owners as (
				select distinct coalesce(s.organization_id, s.user_id) as owner_id
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
					and s.status in (${liveSubscriptionStatusList()})
			),
			active_users as (
				select count(distinct coalesce(e.organization_id, e.user_id))::bigint as count
				from ai_usage_events e
				cross join bounds b
				where e.created_at >= b.range_start
					and e.created_at < b.range_end
			),
			feature_events as (
				select
					'websites'::text as key,
					coalesce(p.organization_id, p.user_id) as owner_id,
					a.completed_at as event_at
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and (a.spec ->> 'pageKind') is distinct from 'cod'
					and a.completed_at >= b.range_start
					and a.completed_at < b.range_end
				union all
				select
					'landingPages'::text as key,
					coalesce(p.organization_id, p.user_id) as owner_id,
					a.completed_at as event_at
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and (a.spec ->> 'pageKind') = 'cod'
					and a.completed_at >= b.range_start
					and a.completed_at < b.range_end
				union all
				select 'images', coalesce(p.organization_id, p.user_id), a.created_at
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
				union all
				select 'videos', coalesce(p.organization_id, p.user_id), a.created_at
				from media_generation_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
				union all
				select 'marketing', coalesce(p.organization_id, p.user_id), a.created_at
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
				union all
				select 'connectors', coalesce(a.organization_id, a.user_id), a.created_at
				from connector_generation_attempts a
				cross join bounds b
				where a.created_at >= b.range_start
					and a.created_at < b.range_end
				union all
				select 'leadScraping', coalesce(p.organization_id, p.user_id), a.created_at
				from lead_scrape_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
				union all
				select 'chat', coalesce(e.organization_id, e.user_id), e.created_at
				from ai_usage_events e
				cross join bounds b
				where e.operation = 'chat'
					and e.created_at >= b.range_start
					and e.created_at < b.range_end
				union all
				select 'publishing', coalesce(p.organization_id, p.user_id), d.created_at
				from deployments d
				inner join projects p on p.id = d.project_id
				cross join bounds b
				where p.deleted_at is null
					and d.created_at >= b.range_start
					and d.created_at < b.range_end
				union all
				select 'domains', coalesce(p.organization_id, d.user_id), d.created_at
				from domains d
				left join projects p on p.id = d.project_id
				cross join bounds b
				where (d.project_id is null or p.deleted_at is null)
					and d.created_at >= b.range_start
					and d.created_at < b.range_end
			),
			feature_owners as (
				select e.key, e.owner_id, min(e.event_at) as first_use_at
				from feature_events e
				group by e.key, e.owner_id
			),
			feature_totals as (
				select
					e.key,
					count(*)::bigint as uses,
					count(distinct e.owner_id)::bigint as users
				from feature_events e
				group by e.key
			),
			paid_totals as (
				select f.key, count(*)::bigint as paid_users
				from feature_owners f
				inner join live_owners l on l.owner_id = f.owner_id
				group by f.key
			),
			first_subscriptions as (
				select
					coalesce(s.organization_id, s.user_id) as owner_id,
					min(s.created_at) as first_subscription_at
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
				group by coalesce(s.organization_id, s.user_id)
			),
			converted_after_use_totals as (
				select f.key, count(*)::bigint as converted_users
				from feature_owners f
				inner join first_subscriptions s on s.owner_id = f.owner_id
				cross join bounds b
				where s.first_subscription_at >= f.first_use_at
					and s.first_subscription_at < b.snapshot_end
				group by f.key
			)
			select
				f.key,
				coalesce(f.users, 0)::bigint as users,
				coalesce(f.uses, 0)::bigint as uses,
				coalesce(p.paid_users, 0)::bigint as paid_users,
				coalesce(c.converted_users, 0)::bigint as converted_after_use_users,
				a.count as active_users
			from active_users a
			left join feature_totals f on true
			left join paid_totals p on p.key = f.key
			left join converted_after_use_totals c on c.key = f.key
			order by f.key
		`);

		return {
			activeUsersInRange: toNumber(result.rows[0]?.active_users),
			features: result.rows.flatMap((row) =>
				row.key === null
					? []
					: [
							{
								key: row.key,
								users: toNumber(row.users),
								uses: toNumber(row.uses),
								paidUsers: toNumber(row.paid_users),
								convertedAfterUseUsers: toNumber(row.converted_after_use_users),
							},
						],
			),
		};
	}

	private async getCreditRange(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<CreditRangeRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			live_owners as (
				select distinct coalesce(s.organization_id, s.user_id) as owner_id
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
					and s.status in (${liveSubscriptionStatusList()})
			),
			ledger_range as (
				select
					coalesce(c.organization_id, c.user_id) as owner_id,
					c.kind,
					c.delta,
					c.idempotency_key
				from credit_ledger c
				cross join bounds b
				where c.created_at >= b.range_start
					and c.created_at < b.range_end
			),
			range_owners as (
				select distinct coalesce(e.organization_id, e.user_id) as owner_id
				from ai_usage_events e
				cross join bounds b
				where e.created_at >= b.range_start
					and e.created_at < b.range_end
				union
				select distinct l.owner_id
				from ledger_range l
				where ${netConsumptionPredicate("l")}
			),
			owner_consumption as (
				select l.owner_id, sum(-l.delta)::bigint as consumed
				from ledger_range l
				where ${netConsumptionPredicate("l")}
				group by l.owner_id
			),
			consumption_totals as (
				select
					coalesce(sum(coalesce(c.consumed, 0)) filter (where l.owner_id is null), 0)::bigint as free_consumed,
					count(*) filter (where l.owner_id is null)::bigint as free_owners,
					coalesce(sum(coalesce(c.consumed, 0)) filter (where l.owner_id is not null), 0)::bigint as paid_consumed,
					count(*) filter (where l.owner_id is not null)::bigint as paid_owners
				from range_owners o
				left join owner_consumption c on c.owner_id = o.owner_id
				left join live_owners l on l.owner_id = o.owner_id
			),
			ledger_totals as (
				select
					coalesce(sum(l.delta) filter (where ${nonRefundGrantPredicate("l")}), 0)::bigint as granted,
					coalesce(sum(-l.delta) filter (where ${netConsumptionPredicate("l")}), 0)::bigint as consumed
				from ledger_range l
			),
			provider_cost as (
				select coalesce(sum(e.reconciled_cost_usd_micros), 0)::bigint as cost_micros
				from ai_usage_events e
				cross join bounds b
				where e.created_at >= b.range_start
					and e.created_at < b.range_end
			)
			select
				l.granted as granted_in_range,
				l.consumed as consumed_in_range,
				c.free_consumed as free_consumed_in_range,
				c.free_owners as free_owners_in_range,
				c.paid_consumed as paid_consumed_in_range,
				c.paid_owners as paid_owners_in_range,
				p.cost_micros as provider_cost_micros
			from ledger_totals l
			cross join consumption_totals c
			cross join provider_cost p
		`);

		const row = result.rows[0];

		return {
			grantedInRange: toNumber(row?.granted_in_range),
			consumedInRange: toNumber(row?.consumed_in_range),
			freeConsumedInRange: toNumber(row?.free_consumed_in_range),
			freeOwnersInRange: toNumber(row?.free_owners_in_range),
			paidConsumedInRange: toNumber(row?.paid_consumed_in_range),
			paidOwnersInRange: toNumber(row?.paid_owners_in_range),
			providerCostMicros: toNumber(row?.provider_cost_micros),
		};
	}

	private async getFreeConsumption(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<FreeConsumptionRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			live_owners as (
				select distinct coalesce(s.organization_id, s.user_id) as owner_id
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
					and s.status in (${liveSubscriptionStatusList()})
			),
			ledger_owner_totals as (
				select
					coalesce(c.organization_id, c.user_id) as owner_id,
					sum(c.delta)::bigint as balance,
					coalesce(sum(-c.delta) filter (where ${netConsumptionPredicate("c")}), 0)::bigint as consumed
				from credit_ledger c
				cross join bounds b
				where c.created_at < b.snapshot_end
				group by coalesce(c.organization_id, c.user_id)
			),
			owner_universe as (
				select u.id as owner_id
				from "user" u
				cross join bounds b
				where u.created_at < b.snapshot_end
				union
				select c.organization_id
				from credit_ledger c
				cross join bounds b
				where c.organization_id is not null
					and c.created_at < b.snapshot_end
			),
			owner_balances as (
				select
					u.owner_id,
					coalesce(l.balance, 0)::bigint as balance,
					coalesce(l.consumed, 0)::bigint as consumed
				from owner_universe u
				left join ledger_owner_totals l on l.owner_id = u.owner_id
			),
			free_owners as (
				select o.owner_id, o.balance, o.consumed
				from owner_balances o
				left join live_owners p on p.owner_id = o.owner_id
				where p.owner_id is null
			),
			distribution as (
				select f.consumed, count(*)::bigint as users
				from free_owners f
				group by f.consumed
			),
			zero_balances as (
				select count(*) filter (where o.balance <= 0)::bigint as users_at_zero_balance
				from owner_balances o
			)
			select
				d.consumed,
				d.users,
				z.users_at_zero_balance
			from zero_balances z
			left join distribution d on true
			order by d.consumed
		`);

		return {
			totals: result.rows.flatMap((row) =>
				row.consumed === null
					? []
					: [{ consumed: toNumber(row.consumed), users: toNumber(row.users) }],
			),
			usersAtZeroBalance: toNumber(result.rows[0]?.users_at_zero_balance),
		};
	}

	private async getCreditsBeforeUpgrade(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<CreditsBeforeUpgradeRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			first_subscriptions as (
				select s.user_id, min(s.created_at) as first_subscription_at
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
				group by s.user_id
			),
			converted_users as (
				select
					f.user_id,
					f.first_subscription_at,
					u.created_at
				from first_subscriptions f
				inner join "user" u on u.id = f.user_id
				cross join bounds b
				where f.first_subscription_at < b.snapshot_end
					and u.created_at < b.snapshot_end
			),
			consumption as (
				select
					u.user_id,
					coalesce(sum(-c.delta), 0)::bigint as consumed
				from converted_users u
				left join credit_ledger c
					on c.user_id = u.user_id
					and ${netConsumptionPredicate("c")}
					and c.created_at >= u.created_at
					and c.created_at < u.first_subscription_at
				group by u.user_id
			)
			select
				coalesce(sum(c.consumed), 0)::bigint as credits_before_upgrade_total,
				count(*)::bigint as converted_users
			from consumption c
		`);

		const row = result.rows[0];

		return {
			creditsBeforeUpgradeTotal: toNumber(row?.credits_before_upgrade_total),
			convertedUsers: toNumber(row?.converted_users),
		};
	}

	private async getFreeCredits(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsFeaturesRepositorySnapshot["freeCredits"]> {
		const result = await client.execute<FreeCreditsRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			signup_grants as (
				select
					l.id as grant_id,
					l.user_id,
					l.created_at as grant_at,
					l.delta as grant_credits
				from credit_ledger l
				cross join bounds b
				where l.kind = 'grant'
					and l.bucket = 'promo'
					and l.organization_id is null
					and l.user_id is not null
					and l.idempotency_key = 'signup:' || l.user_id
					and l.created_at < b.snapshot_end
			),
			promo_consumption as (
				select
					g.grant_id,
					g.user_id,
					g.grant_at,
					g.grant_credits,
					c.created_at as consumed_at,
					sum(-c.delta) over (
						partition by g.user_id
						order by c.created_at, c.id
						rows between unbounded preceding and current row
					) as cumulative_consumed
				from signup_grants g
				inner join credit_ledger c
					on c.user_id = g.user_id
					and c.organization_id is null
					and c.bucket = 'promo'
					and c.kind = 'consume'
					and c.created_at >= g.grant_at
				cross join bounds b
				where c.created_at < b.snapshot_end
			),
			crossings as (
				select distinct on (c.user_id)
					c.grant_id,
					c.user_id,
					c.grant_at,
					c.consumed_at as crossing_at
				from promo_consumption c
				where c.cumulative_consumed >= c.grant_credits
				order by c.user_id, c.consumed_at
			),
			first_subscriptions as (
				select s.user_id, min(s.created_at) as first_subscription_at
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
				group by s.user_id
			),
			measured_crossings as (
				select
					extract(epoch from (c.crossing_at - c.grant_at)) as seconds
				from crossings c
				left join first_subscriptions s on s.user_id = c.user_id
				where (s.first_subscription_at is null
						or s.first_subscription_at >= c.crossing_at)
					and not exists (
						select 1
						from credit_ledger other_grant
						where other_grant.user_id = c.user_id
							and other_grant.organization_id is null
							and other_grant.id <> c.grant_id
							and other_grant.bucket = 'promo'
							and other_grant.kind = 'grant'
							and other_grant.delta > 0
							and other_grant.created_at < c.crossing_at
					)
			)
			select
				avg(m.seconds)::double precision as avg_seconds_to_consume,
				(
					percentile_cont(0.5) within group (order by m.seconds)
				)::double precision as median_seconds_to_consume,
				count(*)::bigint as measured_users
			from measured_crossings m
		`);

		const row = result.rows[0];
		return {
			avgSecondsToConsume: toNullableNumber(row?.avg_seconds_to_consume),
			medianSecondsToConsume: toNullableNumber(row?.median_seconds_to_consume),
			measuredUsers: toNumber(row?.measured_users),
		};
	}

	private async getConversionByCredits(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminAnalyticsFeaturesRepositorySnapshot["conversionByCredits"]> {
		const result = await client.execute<ConversionByCreditsRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			owner_universe as (
				select u.id as owner_id
				from "user" u
				cross join bounds b
				where u.created_at < b.snapshot_end
				union
				select c.organization_id
				from credit_ledger c
				cross join bounds b
				where c.organization_id is not null
					and c.created_at < b.snapshot_end
			),
			owner_consumption as (
				select
					coalesce(c.organization_id, c.user_id) as owner_id,
					coalesce(
						sum(-c.delta) filter (where ${netConsumptionPredicate("c")}),
						0
					)::bigint as consumed
				from credit_ledger c
				cross join bounds b
				where c.created_at < b.snapshot_end
				group by coalesce(c.organization_id, c.user_id)
			),
			ever_paid_owners as (
				select distinct coalesce(s.organization_id, s.user_id) as owner_id
				from subscriptions s
				cross join bounds b
				where s.created_at < b.snapshot_end
			),
			owner_totals as (
				select
					u.owner_id,
					coalesce(c.consumed, 0)::bigint as consumed,
					(p.owner_id is not null) as paid
				from owner_universe u
				left join owner_consumption c on c.owner_id = u.owner_id
				left join ever_paid_owners p on p.owner_id = u.owner_id
			)
			select
				o.consumed,
				count(*)::bigint as owners,
				count(*) filter (where o.paid)::bigint as paid_owners
			from owner_totals o
			group by o.consumed
			order by o.consumed
		`);

		return result.rows.map((row) => ({
			consumed: toNumber(row.consumed),
			owners: toNumber(row.owners),
			paidOwners: toNumber(row.paid_owners),
		}));
	}

	private async getGenerationHealth(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<GenerationHealthRow>(sql`
			with bounds as (${analyticsBounds(input)}),
			terminal_attempts as (
				select
					'pages'::text as key,
					a.status::text as status,
					case
						when a.completed_at >= coalesce(a.started_at, a.created_at)
							then extract(epoch from (a.completed_at - coalesce(a.started_at, a.created_at))) * 1000
					end as latency_ms
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.status in ('succeeded', 'failed')
					and a.completed_at >= b.range_start
					and a.completed_at < b.range_end
				union all
				select
					'images',
					a.status::text,
					case
						when a.started_at is not null and a.completed_at >= a.started_at
							then extract(epoch from (a.completed_at - a.started_at)) * 1000
					end
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.status in ('succeeded', 'failed')
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
					and a.completed_at < b.range_end
				union all
				select
					'videos',
					a.status::text,
					case
						when a.started_at is not null and a.completed_at >= a.started_at
							then extract(epoch from (a.completed_at - a.started_at)) * 1000
					end
				from media_generation_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.status in ('succeeded', 'failed')
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
					and a.completed_at < b.range_end
				union all
				select
					'marketing',
					a.status::text,
					case
						when a.started_at is not null and a.completed_at >= a.started_at
							then extract(epoch from (a.completed_at - a.started_at)) * 1000
					end
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.status in ('succeeded', 'failed')
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
					and a.completed_at < b.range_end
				union all
				select
					'connectors',
					a.status::text,
					case
						when a.completed_at >= coalesce(a.started_at, a.created_at)
							then extract(epoch from (a.completed_at - coalesce(a.started_at, a.created_at))) * 1000
					end
				from connector_generation_attempts a
				cross join bounds b
				where a.status in ('succeeded', 'failed')
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
					and a.completed_at < b.range_end
				union all
				select
					'leadScraping',
					a.status::text,
					case
						when a.completed_at >= coalesce(a.started_at, a.created_at)
							then extract(epoch from (a.completed_at - coalesce(a.started_at, a.created_at))) * 1000
					end
				from lead_scrape_attempts a
				inner join projects p on p.id = a.project_id
				cross join bounds b
				where p.deleted_at is null
					and a.status in ('succeeded', 'failed')
					and a.created_at >= b.range_start
					and a.created_at < b.range_end
					and a.completed_at < b.range_end
			)
			select
				a.key,
				count(*)::bigint as attempts,
				count(*) filter (where a.status = 'succeeded')::bigint as successful,
				count(*) filter (where a.status = 'failed')::bigint as failed,
				coalesce(
					percentile_cont(0.5) within group (order by a.latency_ms)
						filter (where a.latency_ms is not null),
					0
				)::double precision as p50_ms,
				coalesce(
					percentile_cont(0.95) within group (order by a.latency_ms)
						filter (where a.latency_ms is not null),
					0
				)::double precision as p95_ms
			from terminal_attempts a
			group by a.key
			order by a.key
		`);

		return result.rows.map((row) => ({
			key: row.key,
			attempts: toNumber(row.attempts),
			successful: toNumber(row.successful),
			failed: toNumber(row.failed),
			p50Ms: toNumber(row.p50_ms),
			p95Ms: toNumber(row.p95_ms),
		}));
	}

	private async getTopPageFailures(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<TopFailureRow>(sql`
			with bounds as (${analyticsBounds(input)})
			select trim(a.failure_code) as code, count(*)::bigint as count
			from page_generation_attempts a
			inner join projects p on p.id = a.project_id
			cross join bounds b
			where p.deleted_at is null
				and a.status = 'failed'
				and a.failure_code is not null
				and trim(a.failure_code) <> ''
				and a.completed_at >= b.range_start
				and a.completed_at < b.range_end
			group by trim(a.failure_code)
			order by count(*) desc, trim(a.failure_code)
			limit 5
		`);

		return result.rows.map((row) => ({
			code: String(row.code),
			count: toNumber(row.count),
		}));
	}

	private async getCreditsRefunded(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<CreditsRefundedRow>(sql`
			with bounds as (${analyticsBounds(input)})
			select coalesce(sum(c.delta), 0)::bigint as credits_refunded
			from credit_ledger c
			inner join ai_usage_events e
				on e.id::text = (c.meta ->> 'usageEventId')
			cross join bounds b
			where c.kind = 'grant'
				and c.delta > 0
				and e.status = 'refunded'
				and c.created_at >= b.range_start
				and c.created_at < b.range_end
		`);

		return toNumber(result.rows[0]?.credits_refunded);
	}

	private async getWebhookHealth(
		client: AdminAnalyticsDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<WebhookHealthRow>(sql`
			with bounds as (${analyticsBounds(input)})
			select
				count(*)::bigint as received,
				count(*) filter (where e.status = 'processed')::bigint as processed,
				count(*) filter (where e.status = 'skipped')::bigint as skipped,
				count(*) filter (where e.status = 'failed')::bigint as failed,
				count(*) filter (where e.dead_lettered_at is not null)::bigint as dead_lettered
			from billing_webhook_events e
			cross join bounds b
			where e.created_at >= b.range_start
				and e.created_at < b.range_end
		`);

		const row = result.rows[0];

		return {
			received: toNumber(row?.received),
			processed: toNumber(row?.processed),
			skipped: toNumber(row?.skipped),
			failed: toNumber(row?.failed),
			deadLettered: toNumber(row?.dead_lettered),
		};
	}
}

const READ_ONLY_TRANSACTION = {
	accessMode: "read only" as const,
	isolationLevel: "repeatable read" as const,
};

const SEARCH_REFERRER_PATTERN =
	"^https?://([^/?#@]+\\.)?(google|bing|duckduckgo|yahoo)\\.[^/:?#]+([/:?#]|$)";

const MILLISECONDS_PER_DAY = 86_400_000;

function analyticsBounds(input: AdminDashboardRangeBounds) {
	return sql`
		select
			${input.rangeStart}::timestamptz as range_start,
			${input.rangeEnd}::timestamptz as range_end,
			${input.seriesEnd}::timestamptz as series_end,
			${input.snapshotEnd}::timestamptz as snapshot_end
	`;
}

// Metering reserves credits up front ('consume' rows) and reverses over-reserves
// and failed generations as positive 'grant' rows keyed 'settle-refund:%',
// 'reconcile-refund:%' or 'refund:%'. Consumption AMOUNTS must net those
// reversals out (their -delta is negative), and grant totals must not count them
// as new credits — otherwise a failed 25-credit video still reads as 25 credits
// "used". Metrics about consume EVENT timing/counts deliberately stay on raw
// 'consume' rows.
function refundGrantPredicate(alias: string): SQL {
	const column = qualifiedColumn(alias, "idempotency_key");
	return sql`(${qualifiedColumn(alias, "kind")} = 'grant'
		and (${column} like 'settle-refund:%'
			or ${column} like 'reconcile-refund:%'
			or ${column} like 'refund:%'))`;
}

function netConsumptionPredicate(alias: string): SQL {
	return sql`(${qualifiedColumn(alias, "kind")} = 'consume'
		or ${refundGrantPredicate(alias)})`;
}

function nonRefundGrantPredicate(alias: string): SQL {
	return sql`(${qualifiedColumn(alias, "kind")} = 'grant'
		and not ${refundGrantPredicate(alias)})`;
}

function acquisitionSourceExpression(
	affiliateAlias: string,
	attributionAlias: string,
): SQL<string> {
	const affiliateUserId = qualifiedColumn(affiliateAlias, "user_id");
	const attributionUserId = qualifiedColumn(attributionAlias, "user_id");
	const utmSource = qualifiedColumn(attributionAlias, "utm_source");
	const referrer = qualifiedColumn(attributionAlias, "referrer");

	return sql<string>`case
		when ${affiliateUserId} is not null then 'affiliate'
		when ${attributionUserId} is null then 'unknown'
		when nullif(btrim(${utmSource}), '') is not null then lower(btrim(${utmSource}))
		when lower(${referrer}) ~ ${SEARCH_REFERRER_PATTERN} then 'organic_search'
		when nullif(btrim(${referrer}), '') is not null then 'referral'
		else 'direct'
	end`;
}

function attributionUserExpression(
	ownerAlias: string,
	organizationBillingAlias: string,
): SQL<string> {
	const organizationId = qualifiedColumn(ownerAlias, "organization_id");
	const userId = qualifiedColumn(ownerAlias, "user_id");
	const organizationAttributionUserId = qualifiedColumn(
		organizationBillingAlias,
		"attribution_user_id",
	);

	return sql<string>`case
		when ${organizationId} is null then ${userId}
		else ${organizationAttributionUserId}
	end`;
}

function filteredUserCohort(
	filters: AdminAnalyticsFilters,
	options: { honorCohortOnly?: boolean } = {},
): SQL {
	const source = filters.source?.trim();
	const sourceExpression = acquisitionSourceExpression("aa", "ua");
	const predicates: SQL[] = [];

	if (source) {
		const normalizedSource = source.toLowerCase();
		predicates.push(
			sql`(
				lower(${sourceExpression}) = ${normalizedSource}
				or lower(btrim(ua.utm_source)) = ${normalizedSource}
			)`,
		);
	}

	if (filters.country) {
		predicates.push(
			sql`upper(btrim(ua.country)) = ${filters.country.toUpperCase()}`,
		);
	}

	if (filters.device) {
		predicates.push(sql`ua.device = ${filters.device}`);
	}

	if (options.honorCohortOnly && filters.cohortOnly === true) {
		predicates.push(sql`u.created_at >= b.range_start`);
		predicates.push(sql`u.created_at < b.range_end`);
	}

	return sql`
		select
			u.id as user_id,
			u.created_at,
			${sourceExpression} as source,
			ua.utm_source,
			ua.utm_campaign,
			ua.country,
			ua.device
		from "user" u
		cross join bounds b
		left join affiliate_attributions aa on aa.user_id = u.id
		left join user_attributions ua on ua.user_id = u.id
		where u.created_at < b.snapshot_end
		${
			predicates.length > 0
				? sql`and ${sql.join(predicates, sql` and `)}`
				: sql``
		}
	`;
}

function qualifiedColumn(alias: string, column: string): SQL {
	return sql.raw(`${alias}.${column}`);
}

function churnPlanExpression(lookupKey: SQL): SQL<string> {
	const proLookupKeys: string[] = [];
	const businessLookupKeys: string[] = [];

	for (const [key, price] of MRR_PRICE_MAP) {
		if (price.plan === "pro") proLookupKeys.push(key);
		if (price.plan === "business") businessLookupKeys.push(key);
	}

	return sql<string>`case
		when ${lookupKey} in (${sql.join(
			proLookupKeys.map((key) => sql`${key}`),
			sql`, `,
		)}) then 'pro'
		when ${lookupKey} in (${sql.join(
			businessLookupKeys.map((key) => sql`${key}`),
			sql`, `,
		)}) then 'business'
		else 'unknown'
	end`;
}

function hasAttributionFilters(filters: AdminAnalyticsFilters): boolean {
	return Boolean(filters.source || filters.country || filters.device);
}

function validCostRecord(
	value: Record<string, number> | null,
): Record<string, number> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};

	return Object.fromEntries(
		Object.entries(value).flatMap(([source, cents]) =>
			typeof cents === "number" && Number.isFinite(cents) && cents >= 0
				? [[source, cents]]
				: [],
		),
	);
}

function liveSubscriptionStatusList() {
	return sql.join(
		LIVE_SUBSCRIPTION_STATUSES.map((status) => sql`${status}`),
		sql`, `,
	);
}

function aiSpendStatusList() {
	return sql.join(
		AI_SPEND_STATUSES.map((status) => sql`${status}`),
		sql`, `,
	);
}

function selectedCalendarDays(input: AdminDashboardRangeBounds): number {
	return Math.max(
		1,
		Math.floor(
			(input.seriesEnd.getTime() - input.rangeStart.getTime()) /
				MILLISECONDS_PER_DAY,
		) + 1,
	);
}

function lifecycleSubscriptionRows(
	rows: readonly RevenueLifecycleRow[],
	rowKind: "churned" | "created" | "mrr_at_start",
): Array<{ priceLookupKey: string; subscriptions: number }> {
	return rows.flatMap((row) =>
		row.row_kind === rowKind && row.price_lookup_key !== null
			? [
					{
						priceLookupKey: row.price_lookup_key,
						subscriptions: toNumber(row.count),
					},
				]
			: [],
	);
}

function isRetentionDay(value: number): value is 1 | 3 | 7 | 14 | 30 {
	return (
		value === 1 || value === 3 || value === 7 || value === 14 || value === 30
	);
}

function isAdminAnalyticsFeatureKey(
	value: string,
): value is AdminAnalyticsFeatureKey {
	return (adminAnalyticsFeatureKeys as readonly string[]).includes(value);
}

function cancellationReason(value: string): CancellationReasonCode | "unknown" {
	if (value === "unknown") return value;
	const parsed = cancellationReasonCodeSchema.safeParse(value);
	return parsed.success ? parsed.data : "unknown";
}

function toNumber(value: NumericValue | undefined): number {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: NumericValue | undefined): number | null {
	if (value === null || value === undefined) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}
