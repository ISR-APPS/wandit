export type OverviewRange = "7d" | "30d" | "90d";

export type OverviewCurrency = "USD" | "DZD";

export type OverviewPaymentProvider = "stripe" | "chargily";

export type OverviewFxMetadata = {
	baseCurrency: "USD";
	quoteCurrency: "DZD";
	quotePerBase: number;
	asOf: string;
	isMock: true;
};

export type OverviewProviderRevenue = {
	provider: OverviewPaymentProvider;
	nativeCurrency: OverviewCurrency;
	nativeTotalMinor: number;
	reportingUsdTotalMinor: number;
	previousReportingUsdTotalMinor: number;
	changePercent: number;
};

export type OverviewRevenueSummary = {
	reportingCurrency: "USD";
	totalReportingUsdMinor: number;
	previousTotalReportingUsdMinor: number;
	changePercent: number;
	stripe: OverviewProviderRevenue;
	chargily: OverviewProviderRevenue;
	fx: OverviewFxMetadata;
};

export type OverviewTotals = {
	tokensUsed: number;
	previousTokensUsed: number;
	tokensChangePercent: number;
	estimatedTokenCostUsdMinor: number;
	previousEstimatedTokenCostUsdMinor: number;
	tokenCostChangePercent: number;
	websitesGenerated: number;
	previousWebsitesGenerated: number;
	websitesChangePercent: number;
	assetsGenerated: number;
	imagesGenerated: number;
	previousImagesGenerated: number;
	imagesChangePercent: number;
	totalUsers: number;
	signups: number;
	previousSignups: number;
	signupsChangePercent: number;
	activeUsers: number;
};

export type OverviewGenerationSummary = {
	attempts: number;
	successful: number;
	failed: number;
	successRatePercent: number;
	previousSuccessRatePercent: number;
	averageLatencyMs: number;
	previousAverageLatencyMs: number;
};

export type OverviewRevenuePoint = {
	date: string;
	label: string;
	stripeUsdMinor: number;
	chargilyUsdEquivalentMinor: number;
	totalUsdEquivalentMinor: number;
};

export type OverviewGrowthPoint = {
	date: string;
	label: string;
	signups: number;
	websitesGenerated: number;
};

export type OverviewGenerationPoint = {
	date: string;
	label: string;
	successful: number;
	failed: number;
	averageLatencyMs: number;
};

export type OverviewModelUsage = {
	modelId: string;
	modelName: string;
	provider: string;
	tokensUsed: number;
	usageSharePercent: number;
	estimatedCostUsdMinor: number;
	generations: number;
};

export type OverviewSnapshot = {
	range: OverviewRange;
	rangeLabel: string;
	generatedAt: string;
	periodStart: string;
	periodEnd: string;
	revenue: OverviewRevenueSummary;
	totals: OverviewTotals;
	generation: OverviewGenerationSummary;
	revenueSeries: OverviewRevenuePoint[];
	growthSeries: OverviewGrowthPoint[];
	generationSeries: OverviewGenerationPoint[];
	modelUsage: OverviewModelUsage[];
};
