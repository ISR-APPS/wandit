import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminOverviewQuery,
	AdminOverviewSignal,
	AdminOverviewSnapshot,
	AdminSignupStats,
	AdminSignupStatsQuery,
} from "@wandit/contracts";
import { AdminRepository } from "../../infrastructure/persistence/admin.repository";
import {
	AdminOverviewRepository,
	type AdminOverviewSignalRow,
} from "../../infrastructure/persistence/admin-overview.repository";
import { aggregateMrr } from "./admin-analytics.metrics";
import { resolveAdminDashboardRange } from "./admin-dashboard-range";

const RANGE_DAYS: Record<AdminSignupStatsQuery["range"], number> = {
	"7d": 7,
	"30d": 30,
	"90d": 90,
};

@Injectable()
export class AdminStatsService {
	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
		@Inject(AdminOverviewRepository)
		private readonly adminOverviewRepository: AdminOverviewRepository,
	) {}

	async getOverviewStats(
		query: AdminOverviewQuery,
	): Promise<AdminOverviewSnapshot> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.adminOverviewRepository.getOverview(
			resolvedRange.bounds,
		);
		const mrr = aggregateMrr(
			snapshot.overviewMetrics.mrrSubscriptions,
			snapshot.overviewMetrics.activePaidUsers,
		);

		return {
			range: query.range,
			rangeLabel: resolvedRange.rangeLabel,
			generatedAt: generatedAt.toISOString(),
			periodStart: snapshot.periodStart,
			periodEnd: snapshot.periodEnd,
			mrrMinor: mrr.mrrMinor,
			healthyTrials: { count: snapshot.overviewMetrics.healthyTrials },
			revenue: {
				reportingCurrency: "USD",
				totalUsdMinor: snapshot.revenue.totalUsdMinor,
				changePercent: snapshot.revenue.changePercent,
			},
			totals: snapshot.totals,
			generation: snapshot.generation,
			revenueSeries: snapshot.revenueSeries.map((point) => ({
				...point,
				label: formatDateLabel(point.date),
			})),
			growthSeries: snapshot.growthSeries.map((point) => ({
				...point,
				label: formatDateLabel(point.date),
			})),
			generationSeries: snapshot.generationSeries.map((point) => ({
				...point,
				label: formatDateLabel(point.date),
			})),
			modelUsage: snapshot.modelUsage.map((model) => ({
				modelId: model.modelId,
				modelName: formatModelName(model.rawModel),
				provider: formatProviderName(model.provider),
				tokensUsed: model.tokensUsed,
				usageSharePercent: model.usageSharePercent,
				costUsdMinor: model.costUsdMinor,
			})),
			recentSignals: snapshot.recentSignals.map(mapRecentSignal),
		};
	}

	async getSignupStats(
		query: AdminSignupStatsQuery,
	): Promise<AdminSignupStats> {
		const [points, totalUsers] = await Promise.all([
			this.adminRepository.getSignupSeries(RANGE_DAYS[query.range]),
			this.adminRepository.countUsers(),
		]);

		return {
			range: query.range,
			// The zero-filled buckets cover the whole range, so their sum is the
			// range total by construction.
			total: points.reduce((sum, point) => sum + point.count, 0),
			totalUsers,
			points,
		};
	}
}

const KNOWN_MODEL_NAMES: Readonly<Record<string, string>> = {
	"anthropic/claude-3-5-haiku": "Claude 3.5 Haiku",
	"anthropic/claude-3-5-sonnet": "Claude 3.5 Sonnet",
	"anthropic/claude-haiku-4.5": "Claude Haiku 4.5",
	"anthropic/claude-sonnet-4": "Claude Sonnet 4",
	"anthropic/claude-sonnet-5": "Claude Sonnet 5",
	"google/gemini-2.5-flash": "Gemini 2.5 Flash",
	"openai/gpt-4o": "GPT-4o",
	"openai/gpt-4o-mini": "GPT-4o mini",
};

function formatModelName(rawModel: string): string {
	const normalized = rawModel.trim().toLowerCase();
	const known = KNOWN_MODEL_NAMES[normalized];

	if (known) {
		return known;
	}

	if (!normalized || normalized === "unknown") {
		return "Unknown model";
	}

	if (normalized === "multiple") {
		return "Multiple models";
	}

	const modelPart = rawModel.split("/").at(-1) ?? rawModel;

	return modelPart
		.split(/[-_.]+/)
		.filter(Boolean)
		.map((part) => {
			const lower = part.toLowerCase();
			if (lower === "gpt") return "GPT";
			if (lower === "openai") return "OpenAI";
			return /^\d/.test(part)
				? part
				: `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
		})
		.join(" ");
}

function formatProviderName(provider: string): string {
	const normalized = provider.trim().toLowerCase();
	const knownProviders: Readonly<Record<string, string>> = {
		anthropic: "Anthropic",
		google: "Google",
		multiple: "Multiple providers",
		openai: "OpenAI",
		openrouter: "OpenRouter",
		unknown: "Unknown provider",
		vercel: "Vercel",
	};

	return (
		knownProviders[normalized] ??
		`${provider.charAt(0).toUpperCase()}${provider.slice(1)}`
	);
}

function mapRecentSignal(signal: AdminOverviewSignalRow): AdminOverviewSignal {
	switch (signal.kind) {
		case "payment":
			return {
				id: signal.id,
				kind: signal.kind,
				title: "Payment captured",
				detail: `${signal.userName} · ${formatPaymentAmount(signal)}`,
				occurredAt: signal.occurredAt,
			};
		case "page_generation_succeeded":
			return {
				id: signal.id,
				kind: signal.kind,
				title:
					signal.durationMs === null
						? "Website generated"
						: `Website generated in ${formatDuration(signal.durationMs)}`,
				detail: `${signal.userName} · ${signal.projectName ?? "Untitled project"}`,
				occurredAt: signal.occurredAt,
			};
		case "page_generation_failed":
			return {
				id: signal.id,
				kind: signal.kind,
				title: "Website generation failed",
				detail: `${signal.userName} · ${signal.projectName ?? "Untitled project"}`,
				occurredAt: signal.occurredAt,
			};
		case "lead":
			return {
				id: signal.id,
				kind: signal.kind,
				title: "New lead captured",
				detail: `${signal.leadName ?? "Unnamed lead"} · ${signal.projectName ?? signal.userName}`,
				occurredAt: signal.occurredAt,
			};
	}
}

function formatPaymentAmount(signal: AdminOverviewSignalRow): string {
	if (signal.amountMinor === null || signal.currency === null) {
		return "Amount unavailable";
	}

	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: signal.currency,
			currencyDisplay: "code",
			maximumFractionDigits: signal.amountMinor % 100 === 0 ? 0 : 2,
		}).format(signal.amountMinor / 100);
	} catch {
		return `${signal.currency} ${(signal.amountMinor / 100).toLocaleString("en-US")}`;
	}
}

function formatDuration(durationMs: number): string {
	const seconds = durationMs / 1_000;
	return seconds < 60
		? `${Math.round(seconds)}s`
		: `${(seconds / 60).toFixed(1)}m`;
}

function formatDateLabel(date: string): string {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	}).format(new Date(`${date}T00:00:00.000Z`));
}
