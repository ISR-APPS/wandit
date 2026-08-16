import { AlertCircleIcon } from "lucide-react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AnalyticsPageSkeleton } from "@/features/analytics/components/analytics-page-skeleton";
import { AnalyticsPageState } from "@/features/analytics/components/analytics-page-state";
import {
	ConversionByCreditsCard,
	FreeCreditsCard,
} from "@/features/analytics/components/credits-rider-cards";
import { FeatureAdoptionTable } from "@/features/analytics/components/features-adoption-table";
import { FunnelDurationCards } from "@/features/analytics/components/funnel-duration-cards";
import { FunnelStepVisualization } from "@/features/analytics/components/funnel-step-visualization";

function renderAnalytics(element: ReactElement) {
	return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

describe("new analytics card states", () => {
	it("renders the shared loading and error states for endpoint-backed cards", () => {
		const loading = renderAnalytics(
			createElement(AnalyticsPageSkeleton, { metricCount: 7 }),
		);
		const error = renderAnalytics(
			createElement(AnalyticsPageState, {
				icon: AlertCircleIcon,
				title: "Analytics could not be loaded",
				description: "Retry to restore this report.",
				onRetry: () => undefined,
			}),
		);

		expect(loading).toContain('aria-label="Loading analytics"');
		expect(loading).toContain('aria-busy="true"');
		expect(error).toContain("Analytics could not be loaded");
		expect(error).toContain(">Retry<");
	});

	it("renders null-safe empty funnel duration cards", () => {
		const html = renderAnalytics(
			createElement(FunnelDurationCards, {
				durations: {
					signupToFirstAction: {
						medianHours: null,
						avgHours: null,
						users: 0,
					},
					signupToFirstGeneration: {
						medianHours: null,
						avgHours: null,
						users: 0,
					},
				},
			}),
		);

		expect(html.match(/data-state="empty"/g)).toHaveLength(2);
		expect(html).toContain("No completed users measured yet");
		expect(html).toContain("0 measured");
		expect(html).toContain("—");
	});

	it("renders funnel duration data in hours and days", () => {
		const html = renderAnalytics(
			createElement(FunnelDurationCards, {
				durations: {
					signupToFirstAction: {
						medianHours: 3.24,
						avgHours: 4.8,
						users: 12,
					},
					signupToFirstGeneration: {
						medianHours: 50.4,
						avgHours: 72,
						users: 7,
					},
				},
			}),
		);

		expect(html.match(/data-state="data"/g)).toHaveLength(2);
		expect(html).toContain("3.2 h");
		expect(html).toContain("2.1 d");
		expect(html).toContain("12 measured");
	});

	it("explains why the visitor step is unavailable with active filters", () => {
		const html = renderAnalytics(
			createElement(FunnelStepVisualization, {
				steps: [{ key: "visitor", count: null, pctOfPrevious: null }],
				hasActiveFilters: true,
			}),
		);

		expect(html).toContain("Not available with filters");
		expect(html).toContain("Anonymous traffic cannot be attributed");
	});

	it("renders free-credit empty and measured states", () => {
		const empty = renderAnalytics(
			createElement(FreeCreditsCard, {
				freeCredits: {
					avgDaysToConsume: null,
					medianDaysToConsume: null,
					measuredUsers: 0,
				},
			}),
		);
		const data = renderAnalytics(
			createElement(FreeCreditsCard, {
				freeCredits: {
					avgDaysToConsume: 4.16,
					medianDaysToConsume: 3.25,
					measuredUsers: 18,
				},
			}),
		);

		expect(empty).toContain('data-state="empty"');
		expect(empty).toContain("Not enough data");
		expect(empty).toContain("—");
		expect(data).toContain('data-state="data"');
		expect(data).toContain("4.2 d");
		expect(data).toContain("3.3 d");
		expect(data).toContain(">18<");
	});

	it("renders conversion empty and bucket data states", () => {
		const empty = renderAnalytics(
			createElement(ConversionByCreditsCard, { points: [] }),
		);
		const data = renderAnalytics(
			createElement(ConversionByCreditsCard, {
				points: [
					{
						bucket: "10-24",
						owners: 8,
						paidOwners: 4,
						paidPct: 50,
					},
				],
			}),
		);

		expect(empty).toContain('data-state="empty"');
		expect(empty).toContain("No credit-conversion cohort yet");
		expect(data).toContain('data-state="data"');
		expect(data).toContain("10–24 credits");
		expect(data).toContain("50%");
	});

	it("renders nullable converted-after-use values in feature adoption", () => {
		const html = renderAnalytics(
			createElement(FeatureAdoptionTable, {
				activeUsersInRange: 3,
				features: [
					{
						key: "websites",
						users: 3,
						pctOfActiveUsers: 100,
						uses: 5,
						avgUsesPerUser: 1.7,
						usersToPaidPct: 33.3,
						convertedAfterUsePct: null,
					},
				],
			}),
		);

		expect(html).toContain("Converted after use");
		expect(html).toContain("—");
	});
});
