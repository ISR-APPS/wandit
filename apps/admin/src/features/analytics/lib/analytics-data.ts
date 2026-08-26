import type {
	AdminAnalyticsActivityByDayPoint,
	AdminAnalyticsCollectedRevenuePoint,
	AdminAnalyticsConsumptionBucket,
	AdminAnalyticsConsumptionBucketPoint,
	AdminAnalyticsConversionByCreditsPoint,
	AdminAnalyticsDaysToConvertBucket,
	AdminAnalyticsDaysToConvertPoint,
	AdminAnalyticsEngagementCohort,
	AdminAnalyticsFeature,
	AdminAnalyticsFeatureKey,
	AdminAnalyticsFunnelStep,
	AdminAnalyticsFunnelStepKey,
	AdminAnalyticsHealthyTrialsByDayPoint,
} from "@wandit/contracts";
import {
	adminAnalyticsConsumptionBuckets,
	adminAnalyticsDaysToConvertBuckets,
	adminAnalyticsFeatureKeys,
	adminAnalyticsFunnelStepKeys,
} from "@wandit/contracts";

import { parseAdminDateToUtcMilliseconds } from "@/lib/admin-date-range";

const MILLISECONDS_PER_DAY = 86_400_000;

type FeatureAdoptionMetadata = {
	label: string;
	description: string;
	mark: string;
	tooltip?: string;
};

export const featureAdoptionMetadata: Record<
	AdminAnalyticsFeatureKey,
	FeatureAdoptionMetadata
> = {
	websites: {
		label: "Websites",
		description: "Full multi-section sites",
		mark: "WS",
		tooltip: "Websites are full multi-section sites.",
	},
	landingPages: {
		label: "Landing pages",
		description: "Single-page cash-on-delivery style pages",
		mark: "LP",
		tooltip: "Landing pages are single-page cash-on-delivery style pages.",
	},
	images: {
		label: "Images",
		description: "Image generation",
		mark: "IM",
	},
	videos: {
		label: "Videos",
		description: "Video generation",
		mark: "VI",
	},
	marketing: {
		label: "Marketing",
		description: "Marketing assets",
		mark: "MA",
	},
	connectors: {
		label: "Connectors",
		description: "Connector runs",
		mark: "CO",
	},
	leadScraping: {
		label: "Lead scraping",
		description: "Lead searches",
		mark: "LS",
	},
	chat: {
		label: "Chat",
		description: "AI conversations",
		mark: "CH",
	},
	publishing: {
		label: "Publishing",
		description: "Site publishes",
		mark: "PU",
	},
	domains: {
		label: "Domains",
		description: "Custom domains",
		mark: "DO",
	},
};

const featureAdoptionOrder = new Map(
	adminAnalyticsFeatureKeys.map((key, index) => [key, index] as const),
);

const daysToConvertBucketLabels = {
	"0": "Same day",
	"1": "1 day",
	"2": "2 days",
	"3": "3 days",
	"4-5": "4–5 days",
	"6-7": "6–7 days",
	"8-14": "8–14 days",
	"15+": "15+ days",
} satisfies Record<AdminAnalyticsDaysToConvertBucket, string>;

const consumptionBucketLabels = {
	"0": "0 credits",
	"1-9": "1–9 credits",
	"10-24": "10–24 credits",
	"25-39": "25–39 credits",
	"40-49": "40–49 credits",
	"50+": "50+ credits",
} satisfies Record<AdminAnalyticsConsumptionBucket, string>;

const acquisitionSourceLabels = new Map<string, string>([
	["affiliate", "Affiliate"],
	["direct", "Direct"],
	["organic_search", "Organic search"],
	["referral", "Referral"],
	["unknown", "Unknown — signed up before tracking"],
]);

export type FunnelStepMetadata = {
	label: string;
	tooltip: string;
	unavailableLabel?: string;
};

export const funnelStepMetadata: Record<
	AdminAnalyticsFunnelStepKey,
	FunnelStepMetadata
> = {
	visitor: {
		label: "Tracked clicks (approximate)",
		tooltip:
			"Story-link and affiliate clicks recorded during the selected range. This is an approximate visitor count.",
	},
	signup: {
		label: "Signup",
		tooltip: "Users who signed up during the selected range.",
	},
	firstAction: {
		label: "First action",
		tooltip:
			"Users in the signup cohort who created a project or started an AI chat.",
	},
	activated: {
		label: "Activated",
		tooltip:
			"Users in the signup cohort with at least one successful generation. For organization projects, a member's generation may be attributed to the project owner.",
	},
	healthyTrial: {
		label: "Healthy trial",
		tooltip:
			"Free users who used at least 20 credits and completed at least two generations in their first seven days.",
	},
	pricingViewed: {
		label: "Pricing viewed",
		tooltip:
			"Users in the signup cohort who viewed a pricing surface. Data is collected from the Phase 3 deploy onward.",
	},
	upgradeClicked: {
		label: "Upgrade clicked",
		tooltip:
			"Users in the signup cohort who clicked an upgrade entry point. Data is collected from the Phase 3 deploy onward.",
	},
	checkoutStarted: {
		label: "Checkout started",
		tooltip:
			"Subscription checkout attempts started by users in the signup cohort.",
	},
	paid: {
		label: "Paid",
		tooltip: "Users in the signup cohort who started a paid subscription.",
	},
};

export type CollectedRevenueChartPoint = AdminAnalyticsCollectedRevenuePoint & {
	totalMinor: number;
};

export type DaysToConvertChartPoint = AdminAnalyticsDaysToConvertPoint & {
	label: string;
};

export type ConsumptionChartPoint = AdminAnalyticsConsumptionBucketPoint & {
	label: string;
};

export type ConversionByCreditsChartPoint =
	AdminAnalyticsConversionByCreditsPoint & {
		label: string;
	};

export type EngagementDailyChartPoint = {
	date: string;
	activeUsers: number;
	healthyTrials: number;
};

export type RetentionHeatmapBucket =
	| "unavailable"
	| "zero"
	| "low"
	| "medium"
	| "high"
	| "strong";

export function formatNullableAnalyticsMetric(
	value: number | null,
	formatter: (value: number) => string,
): string {
	return value === null ? "—" : formatter(value);
}

export function formatAnalyticsDurationHours(
	value: number | null,
	locale = "en-US",
): string {
	if (value === null || !Number.isFinite(value) || value < 0) return "—";

	const duration = value >= 48 ? value / 24 : value;
	const unit = value >= 48 ? "d" : "h";
	const formatted = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
	}).format(duration);

	return `${formatted} ${unit}`;
}

export function formatAnalyticsDays(
	value: number | null,
	locale = "en-US",
): string {
	if (value === null || !Number.isFinite(value) || value < 0) return "—";

	return `${new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
	}).format(value)} d`;
}

export function hasNonZeroAnalyticsValue(
	values: readonly (number | null)[],
): boolean {
	return values.some(
		(value) => value !== null && Number.isFinite(value) && value !== 0,
	);
}

export function formatAcquisitionSource(source: string): string {
	return acquisitionSourceLabels.get(source) ?? source;
}

export function orderFunnelSteps(
	steps: readonly AdminAnalyticsFunnelStep[],
): AdminAnalyticsFunnelStep[] {
	const stepsByKey = new Map(steps.map((step) => [step.key, step]));

	return adminAnalyticsFunnelStepKeys.map(
		(key) =>
			stepsByKey.get(key) ?? {
				key,
				count: null,
				pctOfPrevious: null,
			},
	);
}

export function mapEngagementDailyChartData(
	activityByDay: readonly AdminAnalyticsActivityByDayPoint[],
	healthyTrialsByDay: readonly AdminAnalyticsHealthyTrialsByDayPoint[],
): EngagementDailyChartPoint[] {
	const valuesByDate = new Map<
		string,
		Pick<EngagementDailyChartPoint, "activeUsers" | "healthyTrials">
	>();
	let firstDay: number | undefined;
	let lastDay: number | undefined;

	function registerDate(date: string): number | undefined {
		const day = parseAdminDateToUtcMilliseconds(date);
		if (day === undefined) return undefined;

		firstDay = firstDay === undefined ? day : Math.min(firstDay, day);
		lastDay = lastDay === undefined ? day : Math.max(lastDay, day);
		return day;
	}

	for (const point of activityByDay) {
		if (registerDate(point.date) === undefined) continue;

		const current = valuesByDate.get(point.date);
		valuesByDate.set(point.date, {
			activeUsers: (current?.activeUsers ?? 0) + point.activeUsers,
			healthyTrials: current?.healthyTrials ?? 0,
		});
	}

	for (const point of healthyTrialsByDay) {
		if (registerDate(point.date) === undefined) continue;

		const current = valuesByDate.get(point.date);
		valuesByDate.set(point.date, {
			activeUsers: current?.activeUsers ?? 0,
			healthyTrials: (current?.healthyTrials ?? 0) + point.count,
		});
	}

	if (firstDay === undefined || lastDay === undefined) {
		return [];
	}

	const result: EngagementDailyChartPoint[] = [];
	for (let day = firstDay; day <= lastDay; day += MILLISECONDS_PER_DAY) {
		const date = new Date(day).toISOString().slice(0, 10);
		const values = valuesByDate.get(date);
		result.push({
			date,
			activeUsers: values?.activeUsers ?? 0,
			healthyTrials: values?.healthyTrials ?? 0,
		});
	}

	return result;
}

export function getRetentionHeatmapColumns(
	cohorts: readonly AdminAnalyticsEngagementCohort[],
): number[] {
	const columnCount = cohorts.reduce(
		(maximum, cohort) => Math.max(maximum, cohort.weeks.length),
		0,
	);

	return Array.from({ length: columnCount }, (_, index) => index);
}

export function getRetentionHeatmapBucket(
	value: number | undefined,
): RetentionHeatmapBucket {
	if (value === undefined || !Number.isFinite(value)) return "unavailable";

	const percentage = clampPercentage(value);
	if (percentage === 0) return "zero";
	if (percentage < 25) return "low";
	if (percentage < 50) return "medium";
	if (percentage < 75) return "high";

	return "strong";
}

export function getDaysToConvertBucketLabel(
	bucket: AdminAnalyticsDaysToConvertBucket,
) {
	return daysToConvertBucketLabels[bucket];
}

export function getConsumptionBucketLabel(
	bucket: AdminAnalyticsConsumptionBucket,
) {
	return consumptionBucketLabels[bucket];
}

export function clampPercentage(value: number) {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.min(100, Math.max(0, value));
}

export function calculatePercentage(part: number, total: number) {
	if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
		return 0;
	}

	return clampPercentage((part / total) * 100);
}

export function orderFeatureAdoptionRows(
	features: readonly AdminAnalyticsFeature[],
) {
	return [...features].sort(
		(left, right) =>
			(featureAdoptionOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
			(featureAdoptionOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER),
	);
}

export function mapCollectedRevenueChartData(
	points: readonly AdminAnalyticsCollectedRevenuePoint[],
): CollectedRevenueChartPoint[] {
	const totalsByDate = new Map<
		string,
		Pick<
			AdminAnalyticsCollectedRevenuePoint,
			"ordersMinor" | "subscriptionsMinor" | "topupsMinor"
		>
	>();

	for (const point of points) {
		const current = totalsByDate.get(point.date);
		totalsByDate.set(point.date, {
			ordersMinor: (current?.ordersMinor ?? 0) + point.ordersMinor,
			subscriptionsMinor:
				(current?.subscriptionsMinor ?? 0) + point.subscriptionsMinor,
			topupsMinor: (current?.topupsMinor ?? 0) + point.topupsMinor,
		});
	}

	return [...totalsByDate.entries()]
		.sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
		.map(([date, revenue]) => ({
			date,
			...revenue,
			totalMinor:
				revenue.subscriptionsMinor + revenue.ordersMinor + revenue.topupsMinor,
		}));
}

export function mapDaysToConvertChartData(
	points: readonly AdminAnalyticsDaysToConvertPoint[],
): DaysToConvertChartPoint[] {
	const countsByBucket = new Map<AdminAnalyticsDaysToConvertBucket, number>();

	for (const point of points) {
		countsByBucket.set(
			point.bucket,
			(countsByBucket.get(point.bucket) ?? 0) + point.count,
		);
	}

	return adminAnalyticsDaysToConvertBuckets.map((bucket) => ({
		bucket,
		label: getDaysToConvertBucketLabel(bucket),
		count: countsByBucket.get(bucket) ?? 0,
	}));
}

export function mapConsumptionChartData(
	points: readonly AdminAnalyticsConsumptionBucketPoint[],
): ConsumptionChartPoint[] {
	const usersByBucket = new Map<AdminAnalyticsConsumptionBucket, number>();

	for (const point of points) {
		usersByBucket.set(
			point.bucket,
			(usersByBucket.get(point.bucket) ?? 0) + point.users,
		);
	}

	return adminAnalyticsConsumptionBuckets.map((bucket) => ({
		bucket,
		label: getConsumptionBucketLabel(bucket),
		users: usersByBucket.get(bucket) ?? 0,
	}));
}

export function mapConversionByCreditsChartData(
	points: readonly AdminAnalyticsConversionByCreditsPoint[],
): ConversionByCreditsChartPoint[] {
	const valuesByBucket = new Map<
		AdminAnalyticsConsumptionBucket,
		Pick<
			AdminAnalyticsConversionByCreditsPoint,
			"owners" | "paidOwners" | "paidPct"
		>
	>();

	for (const point of points) {
		const current = valuesByBucket.get(point.bucket);
		const owners = (current?.owners ?? 0) + point.owners;
		const paidOwners = (current?.paidOwners ?? 0) + point.paidOwners;
		valuesByBucket.set(point.bucket, {
			owners,
			paidOwners,
			paidPct:
				current === undefined
					? point.paidPct
					: current.paidPct === null || point.paidPct === null
						? null
						: calculatePercentage(paidOwners, owners),
		});
	}

	return adminAnalyticsConsumptionBuckets.map((bucket) => {
		const values = valuesByBucket.get(bucket) ?? {
			owners: 0,
			paidOwners: 0,
			paidPct: null,
		};

		return {
			bucket,
			label: getConsumptionBucketLabel(bucket),
			...values,
		};
	});
}
