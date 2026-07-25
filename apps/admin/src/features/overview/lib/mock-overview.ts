import type {
	OverviewGenerationPoint,
	OverviewGenerationSummary,
	OverviewGrowthPoint,
	OverviewModelUsage,
	OverviewRange,
	OverviewRevenuePoint,
	OverviewSnapshot,
} from "../api/overview.dto";

const DAY_MS = 86_400_000;
const GENERATED_AT = "2026-07-23T09:30:00.000Z";
const PERIOD_END_MS = Date.parse("2026-07-23T00:00:00.000Z");
const FX_DZD_PER_USD = 135.42;
const FX_AS_OF = "2026-07-23";
const TOTAL_USERS = 14_862;

const RANGE_CONFIG = {
	"7d": {
		days: 7,
		bucketDays: 1,
		label: "Last 7 days",
		activeUsers: 4_317,
	},
	"30d": {
		days: 30,
		bucketDays: 3,
		label: "Last 30 days",
		activeUsers: 8_746,
	},
	"90d": {
		days: 90,
		bucketDays: 7,
		label: "Last 90 days",
		activeUsers: 12_193,
	},
} as const satisfies Record<
	OverviewRange,
	{
		days: number;
		bucketDays: number;
		label: string;
		activeUsers: number;
	}
>;

type DailyOverviewRecord = {
	date: string;
	stripeUsdMinor: number;
	chargilyDzdMinor: number;
	chargilyUsdEquivalentMinor: number;
	signups: number;
	tokensUsed: number;
	estimatedTokenCostUsdMinor: number;
	websitesGenerated: number;
	assetsGenerated: number;
	imagesGenerated: number;
	successful: number;
	failed: number;
	averageLatencyMs: number;
};

type ModelDefinition = {
	modelId: string;
	modelName: string;
	provider: string;
	tokenWeights: Record<OverviewRange, number>;
	costWeight: number;
	generationWeight: number;
};

const MODEL_DEFINITIONS: readonly ModelDefinition[] = [
	{
		modelId: "anthropic/claude-sonnet-5",
		modelName: "Claude Sonnet 5",
		provider: "Anthropic",
		tokenWeights: { "7d": 0.442, "30d": 0.428, "90d": 0.414 },
		costWeight: 0.596,
		generationWeight: 0.386,
	},
	{
		modelId: "openai/gpt-4o-mini",
		modelName: "GPT-4o mini",
		provider: "OpenAI",
		tokenWeights: { "7d": 0.271, "30d": 0.283, "90d": 0.294 },
		costWeight: 0.117,
		generationWeight: 0.329,
	},
	{
		modelId: "google/gemini-2.5-flash",
		modelName: "Gemini 2.5 Flash",
		provider: "Google",
		tokenWeights: { "7d": 0.183, "30d": 0.178, "90d": 0.171 },
		costWeight: 0.089,
		generationWeight: 0.19,
	},
	{
		modelId: "anthropic/claude-haiku-4.5",
		modelName: "Claude Haiku 4.5",
		provider: "Anthropic",
		tokenWeights: { "7d": 0.104, "30d": 0.111, "90d": 0.121 },
		costWeight: 0.198,
		generationWeight: 0.095,
	},
];

const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});

const DAILY_RECORDS = createDailyRecords(180);

export const MOCK_OVERVIEW_SNAPSHOTS: Record<OverviewRange, OverviewSnapshot> =
	{
		"7d": buildSnapshot("7d"),
		"30d": buildSnapshot("30d"),
		"90d": buildSnapshot("90d"),
	};

export function getMockOverviewSnapshot(
	range: OverviewRange,
): OverviewSnapshot {
	return MOCK_OVERVIEW_SNAPSHOTS[range];
}

function createDailyRecords(count: number): DailyOverviewRecord[] {
	const firstDayMs = PERIOD_END_MS - (count - 1) * DAY_MS;

	return Array.from({ length: count }, (_, index) => {
		const date = new Date(firstDayMs + index * DAY_MS);
		const sequence = index + 19;
		const dayOfWeek = date.getUTCDay();
		const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

		const stripeUsdMinor =
			28_700 +
			sequence * 61 +
			((sequence * 7_919) % 18_900) +
			(isWeekend ? -3_800 : 1_750);
		const chargilyDzdMinor =
			3_080_000 +
			sequence * 7_430 +
			((sequence * 104_729) % 1_720_000) +
			(isWeekend ? -260_000 : 145_000);
		const signups = Math.max(
			8,
			14 +
				Math.floor(sequence / 38) +
				((sequence * 11) % 18) -
				(isWeekend ? 3 : 0),
		);
		const successful = Math.max(
			15,
			21 +
				Math.floor(sequence / 72) +
				((sequence * 13) % 24) -
				(isWeekend ? 3 : 0),
		);
		const failed = 1 + ((sequence * 5) % 3) + (sequence % 29 === 0 ? 2 : 0);
		const assetsGenerated =
			successful * (5 + (sequence % 3)) + ((sequence * 29) % 47);
		const imagesGenerated = Math.round(
			assetsGenerated * (0.54 + (sequence % 5) * 0.035),
		);
		const tokensUsed =
			2_240_000 +
			sequence * 6_970 +
			((sequence * 15_485_863) % 1_460_000) +
			successful * 12_700;
		const blendedCostUsdPerMillion = 7.18 + ((sequence * 17) % 137) / 100;

		return {
			date: date.toISOString().slice(0, 10),
			stripeUsdMinor,
			chargilyDzdMinor,
			chargilyUsdEquivalentMinor: Math.round(chargilyDzdMinor / FX_DZD_PER_USD),
			signups,
			tokensUsed,
			estimatedTokenCostUsdMinor: Math.round(
				(tokensUsed / 1_000_000) * blendedCostUsdPerMillion * 100,
			),
			websitesGenerated: successful,
			assetsGenerated,
			imagesGenerated,
			successful,
			failed,
			averageLatencyMs: 63_000 + ((sequence * 3_571) % 52_000) + failed * 1_350,
		};
	});
}

function buildSnapshot(range: OverviewRange): OverviewSnapshot {
	const config = RANGE_CONFIG[range];
	const currentStart = DAILY_RECORDS.length - config.days;
	const previousStart = currentStart - config.days;
	const current = DAILY_RECORDS.slice(currentStart);
	const previous = DAILY_RECORDS.slice(previousStart, currentStart);

	const currentStripeUsdMinor = total(current, "stripeUsdMinor");
	const previousStripeUsdMinor = total(previous, "stripeUsdMinor");
	const currentChargilyDzdMinor = total(current, "chargilyDzdMinor");
	const currentChargilyUsdMinor = total(current, "chargilyUsdEquivalentMinor");
	const previousChargilyUsdMinor = total(
		previous,
		"chargilyUsdEquivalentMinor",
	);
	const currentRevenueUsdMinor =
		currentStripeUsdMinor + currentChargilyUsdMinor;
	const previousRevenueUsdMinor =
		previousStripeUsdMinor + previousChargilyUsdMinor;

	const tokensUsed = total(current, "tokensUsed");
	const previousTokensUsed = total(previous, "tokensUsed");
	const estimatedTokenCostUsdMinor = total(
		current,
		"estimatedTokenCostUsdMinor",
	);
	const previousEstimatedTokenCostUsdMinor = total(
		previous,
		"estimatedTokenCostUsdMinor",
	);
	const websitesGenerated = total(current, "websitesGenerated");
	const previousWebsitesGenerated = total(previous, "websitesGenerated");
	const imagesGenerated = total(current, "imagesGenerated");
	const previousImagesGenerated = total(previous, "imagesGenerated");
	const signups = total(current, "signups");
	const previousSignups = total(previous, "signups");

	const generation = buildGenerationSummary(current, previous);

	return {
		range,
		rangeLabel: config.label,
		generatedAt: GENERATED_AT,
		periodStart: current[0]?.date ?? FX_AS_OF,
		periodEnd: current.at(-1)?.date ?? FX_AS_OF,
		revenue: {
			reportingCurrency: "USD",
			totalReportingUsdMinor: currentRevenueUsdMinor,
			previousTotalReportingUsdMinor: previousRevenueUsdMinor,
			changePercent: percentChange(
				currentRevenueUsdMinor,
				previousRevenueUsdMinor,
			),
			stripe: {
				provider: "stripe",
				nativeCurrency: "USD",
				nativeTotalMinor: currentStripeUsdMinor,
				reportingUsdTotalMinor: currentStripeUsdMinor,
				previousReportingUsdTotalMinor: previousStripeUsdMinor,
				changePercent: percentChange(
					currentStripeUsdMinor,
					previousStripeUsdMinor,
				),
			},
			chargily: {
				provider: "chargily",
				nativeCurrency: "DZD",
				nativeTotalMinor: currentChargilyDzdMinor,
				reportingUsdTotalMinor: currentChargilyUsdMinor,
				previousReportingUsdTotalMinor: previousChargilyUsdMinor,
				changePercent: percentChange(
					currentChargilyUsdMinor,
					previousChargilyUsdMinor,
				),
			},
			fx: {
				baseCurrency: "USD",
				quoteCurrency: "DZD",
				quotePerBase: FX_DZD_PER_USD,
				asOf: FX_AS_OF,
				isMock: true,
			},
		},
		totals: {
			tokensUsed,
			previousTokensUsed,
			tokensChangePercent: percentChange(tokensUsed, previousTokensUsed),
			estimatedTokenCostUsdMinor,
			previousEstimatedTokenCostUsdMinor,
			tokenCostChangePercent: percentChange(
				estimatedTokenCostUsdMinor,
				previousEstimatedTokenCostUsdMinor,
			),
			websitesGenerated,
			previousWebsitesGenerated,
			websitesChangePercent: percentChange(
				websitesGenerated,
				previousWebsitesGenerated,
			),
			assetsGenerated: total(current, "assetsGenerated"),
			imagesGenerated,
			previousImagesGenerated,
			imagesChangePercent: percentChange(
				imagesGenerated,
				previousImagesGenerated,
			),
			totalUsers: TOTAL_USERS,
			signups,
			previousSignups,
			signupsChangePercent: percentChange(signups, previousSignups),
			activeUsers: config.activeUsers,
		},
		generation,
		revenueSeries: buildRevenueSeries(current, config.bucketDays),
		growthSeries: buildGrowthSeries(current, config.bucketDays),
		generationSeries: buildGenerationSeries(current, config.bucketDays),
		modelUsage: buildModelUsage(
			range,
			tokensUsed,
			estimatedTokenCostUsdMinor,
			generation.successful,
		),
	};
}

function buildRevenueSeries(
	records: DailyOverviewRecord[],
	bucketDays: number,
): OverviewRevenuePoint[] {
	return toBuckets(records, bucketDays).map((bucket) => {
		const stripeUsdMinor = total(bucket, "stripeUsdMinor");
		const chargilyUsdEquivalentMinor = total(
			bucket,
			"chargilyUsdEquivalentMinor",
		);

		return {
			date: bucket.at(-1)?.date ?? FX_AS_OF,
			label: formatBucketLabel(bucket),
			stripeUsdMinor,
			chargilyUsdEquivalentMinor,
			totalUsdEquivalentMinor: stripeUsdMinor + chargilyUsdEquivalentMinor,
		};
	});
}

function buildGrowthSeries(
	records: DailyOverviewRecord[],
	bucketDays: number,
): OverviewGrowthPoint[] {
	return toBuckets(records, bucketDays).map((bucket) => ({
		date: bucket.at(-1)?.date ?? FX_AS_OF,
		label: formatBucketLabel(bucket),
		signups: total(bucket, "signups"),
		websitesGenerated: total(bucket, "websitesGenerated"),
	}));
}

function buildGenerationSeries(
	records: DailyOverviewRecord[],
	bucketDays: number,
): OverviewGenerationPoint[] {
	return toBuckets(records, bucketDays).map((bucket) => ({
		date: bucket.at(-1)?.date ?? FX_AS_OF,
		label: formatBucketLabel(bucket),
		successful: total(bucket, "successful"),
		failed: total(bucket, "failed"),
		averageLatencyMs: weightedAverageLatency(bucket),
	}));
}

function buildGenerationSummary(
	current: DailyOverviewRecord[],
	previous: DailyOverviewRecord[],
): OverviewGenerationSummary {
	const successful = total(current, "successful");
	const failed = total(current, "failed");
	const attempts = successful + failed;
	const previousSuccessful = total(previous, "successful");
	const previousFailed = total(previous, "failed");

	return {
		attempts,
		successful,
		failed,
		successRatePercent: ratioPercent(successful, attempts),
		previousSuccessRatePercent: ratioPercent(
			previousSuccessful,
			previousSuccessful + previousFailed,
		),
		averageLatencyMs: weightedAverageLatency(current),
		previousAverageLatencyMs: weightedAverageLatency(previous),
	};
}

function buildModelUsage(
	range: OverviewRange,
	tokensUsed: number,
	estimatedCostUsdMinor: number,
	generations: number,
): OverviewModelUsage[] {
	const tokenWeights = MODEL_DEFINITIONS.map(
		(model) => model.tokenWeights[range],
	);
	const tokensByModel = allocateInteger(tokensUsed, tokenWeights);
	const costsByModel = allocateInteger(
		estimatedCostUsdMinor,
		MODEL_DEFINITIONS.map((model) => model.costWeight),
	);
	const generationsByModel = allocateInteger(
		generations,
		MODEL_DEFINITIONS.map((model) => model.generationWeight),
	);

	return MODEL_DEFINITIONS.map((model, index) => {
		const modelTokens = tokensByModel[index] ?? 0;

		return {
			modelId: model.modelId,
			modelName: model.modelName,
			provider: model.provider,
			tokensUsed: modelTokens,
			usageSharePercent: ratioPercent(modelTokens, tokensUsed),
			estimatedCostUsdMinor: costsByModel[index] ?? 0,
			generations: generationsByModel[index] ?? 0,
		};
	});
}

function toBuckets(
	records: DailyOverviewRecord[],
	bucketDays: number,
): DailyOverviewRecord[][] {
	const buckets: DailyOverviewRecord[][] = [];

	for (let index = 0; index < records.length; index += bucketDays) {
		buckets.push(records.slice(index, index + bucketDays));
	}

	return buckets;
}

function formatBucketLabel(records: DailyOverviewRecord[]) {
	const first = records[0];
	const last = records.at(-1);

	if (!first || !last) {
		return "";
	}

	const firstLabel = dateLabelFormatter.format(
		new Date(`${first.date}T00:00:00.000Z`),
	);
	const lastLabel = dateLabelFormatter.format(
		new Date(`${last.date}T00:00:00.000Z`),
	);

	return first.date === last.date ? firstLabel : `${firstLabel} – ${lastLabel}`;
}

function total(records: DailyOverviewRecord[], key: keyof DailyOverviewRecord) {
	return records.reduce((sum, record) => {
		const value = record[key];
		return sum + (typeof value === "number" ? value : 0);
	}, 0);
}

function weightedAverageLatency(records: DailyOverviewRecord[]) {
	const totalAttempts = records.reduce(
		(sum, record) => sum + record.successful + record.failed,
		0,
	);

	if (totalAttempts === 0) {
		return 0;
	}

	const weightedTotal = records.reduce(
		(sum, record) =>
			sum + record.averageLatencyMs * (record.successful + record.failed),
		0,
	);

	return Math.round(weightedTotal / totalAttempts);
}

function allocateInteger(totalValue: number, weights: readonly number[]) {
	let remaining = totalValue;

	return weights.map((weight, index) => {
		if (index === weights.length - 1) {
			return remaining;
		}

		const value = Math.round(totalValue * weight);
		remaining -= value;
		return value;
	});
}

function percentChange(current: number, previous: number) {
	if (previous === 0) {
		return current === 0 ? 0 : 100;
	}

	return roundToOne(((current - previous) / previous) * 100);
}

function ratioPercent(value: number, totalValue: number) {
	if (totalValue === 0) {
		return 0;
	}

	return roundToOne((value / totalValue) * 100);
}

function roundToOne(value: number) {
	return Math.round(value * 10) / 10;
}
