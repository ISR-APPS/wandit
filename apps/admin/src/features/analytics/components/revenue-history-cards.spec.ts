import { ChartNoAxesCombinedIcon } from "lucide-react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { AnalyticsPageSkeleton } from "./analytics-page-skeleton";
import { AnalyticsPageState } from "./analytics-page-state";
import { ChurnBreakdownCard } from "./churn-breakdown-card";
import { RevenueRetentionCard } from "./revenue-retention-card";

function render(element: ReactElement) {
	return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

describe("revenue history card states", () => {
	it("uses the revenue page loading and error states before cards receive data", () => {
		const loading = render(createElement(AnalyticsPageSkeleton));
		const error = render(
			createElement(AnalyticsPageState, {
				icon: ChartNoAxesCombinedIcon,
				title: "Revenue analytics could not be loaded",
				description: "Billing and retention data did not respond.",
			}),
		);

		expect(loading).toContain('aria-label="Loading analytics"');
		expect(error).toContain("Revenue analytics could not be loaded");
	});

	it("renders empty and ragged data states for paid and revenue retention", () => {
		const empty = render(
			createElement(RevenueRetentionCard, {
				retention: { cohorts: [] },
			}),
		);
		const data = render(
			createElement(RevenueRetentionCard, {
				retention: {
					cohorts: [
						{
							cohortMonth: "2026-07-01",
							owners: 4,
							m0MrrCents: 12_500,
							points: [
								{ paidPct: 100, revenuePct: 100 },
								{ paidPct: 75, revenuePct: 120 },
							],
						},
						{
							cohortMonth: "2026-08-01",
							owners: 2,
							m0MrrCents: 0,
							points: [{ paidPct: 50, revenuePct: null }],
						},
					],
				},
			}),
		);

		expect(empty).toContain("No subscription retention cohorts yet");
		expect(data).toContain("M1");
		expect(data).toContain("Jul 2026");
		expect(data).toContain("$125");
		expect(data).toContain("120% revenue");
		expect(data).toContain("— revenue");
	});

	it("renders empty and populated churn breakdown states", () => {
		const emptyBreakdown = {
			byPlan: [],
			bySource: [],
			byReason: [],
			byCountry: [],
			byFeature: [],
		};
		const empty = render(
			createElement(ChurnBreakdownCard, { breakdown: emptyBreakdown }),
		);
		const data = render(
			createElement(ChurnBreakdownCard, {
				breakdown: {
					byPlan: [{ plan: "business", churned: 2, churnedMrrCents: 2_900 }],
					bySource: [{ source: "organic_search", churned: 1 }],
					byReason: [{ reason: "unknown", churned: 1 }],
					byCountry: [{ country: "DZ", churned: 1 }],
					byFeature: [{ feature: "landingPages", churned: 2 }],
				},
			}),
		);

		expect(empty).toContain("No churn recorded in this range");
		expect(data).toContain("$29 churned MRR");
		expect(data).toContain("Organic search");
		expect(data).toContain("Unknown (pre-survey)");
		expect(data).toContain("Landing pages");
		expect(data).toContain("since July");
	});
});
