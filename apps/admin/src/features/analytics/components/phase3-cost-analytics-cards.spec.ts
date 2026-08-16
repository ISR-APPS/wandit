import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AcquisitionAnalyticsTables } from "@/features/analytics/components/acquisition-analytics-tables";
import {
	AcquisitionCostMetrics,
	acquisitionCostCoverageTooltip,
} from "@/features/analytics/components/acquisition-cost-metrics";
import {
	formatUnitEconomicsMonths,
	formatUnitEconomicsRatio,
	missingCostCoverageTooltip,
	UnitEconomicsCard,
} from "@/features/analytics/components/unit-economics-card";
import { hasAcquisitionActivity } from "@/features/analytics/pages/acquisition-analytics-page";

function renderAnalytics(element: ReactElement) {
	return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

describe("Phase 3 cost analytics cards", () => {
	it("formats ratio and CAC payback values without losing meaningful precision", () => {
		expect(formatUnitEconomicsRatio(4.256)).toBe("4.26×");
		expect(formatUnitEconomicsMonths(5.25)).toBe("5.3 mo");
	});

	it("renders every unit-economics signal and cost total", () => {
		const html = renderAnalytics(
			createElement(UnitEconomicsCard, {
				unitEconomics: {
					adSpendCents: 123_456,
					infrastructureCostCents: 42_000,
					otherCostCents: 9_999,
					totalCostCents: 175_455,
					cacCents: 12_345,
					ltvCacRatio: 3.4,
					grossMarginPct: 62.5,
					cacPaybackMonths: 5.2,
					costPerFreeActiveUserCents: 321,
					costPerHealthyTrialCents: 654,
					costPerActivePaidUserCents: 987,
					costCoverageComplete: true,
				},
			}),
		);

		expect(html).toContain('data-state="complete"');
		expect(html).toContain("Unit economics");
		expect(html).toContain("LTV:CAC");
		expect(html).toContain("3.4×");
		expect(html).toContain("62.5%");
		expect(html).toContain("5.2 mo");
		expect(html).toContain("Cost / free active user");
		expect(html).toContain("Cost / healthy trial");
		expect(html).toContain("Cost / active paid user");
		expect(html).toContain("$1,234.56");
		expect(html).toContain("Total costs");
		expect(html).not.toContain('href="/costs"');
	});

	it("renders em dashes and a costs link when monthly coverage is incomplete", () => {
		const html = renderAnalytics(
			createElement(UnitEconomicsCard, {
				unitEconomics: {
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
				},
			}),
		);

		expect(missingCostCoverageTooltip).toBe(
			"needs cost data for every month in range",
		);
		expect(html).toContain('data-state="incomplete"');
		expect(html.match(/—/g)).toHaveLength(11);
		expect(html).toContain("Coverage incomplete");
		expect(html).toContain('href="/costs"');
	});

	it("distinguishes attribution-filter nulls from missing cost coverage", () => {
		const html = renderAnalytics(
			createElement(AcquisitionCostMetrics, {
				adSpendCents: null,
				cacCents: null,
				costCoverageComplete: true,
				unattributedSignups: 12,
				hasActiveAttributionFilters: true,
			}),
		);

		expect(html).toContain('data-state="filtered"');
		expect(html.match(/—/g)).toHaveLength(2);
		expect(html).toContain("Unavailable with attribution filters");
		expect(html).toContain(
			"Cost metrics are unavailable with attribution filters",
		);
		expect(html).not.toContain('href="/costs"');
	});

	it("keeps filtered cost guidance visible when filtered rows are empty", () => {
		expect(
			hasAcquisitionActivity(
				{
					updatedAt: "2026-08-15T12:00:00.000Z",
					adSpendCents: null,
					cacCents: null,
					costCoverageComplete: true,
					sources: [],
					campaigns: [],
					countries: [],
					unattributed: { signups: 0 },
				},
				true,
			),
		).toBe(true);
	});

	it("links incomplete acquisition coverage to monthly costs", () => {
		const html = renderAnalytics(
			createElement(AcquisitionCostMetrics, {
				adSpendCents: null,
				cacCents: null,
				costCoverageComplete: false,
				unattributedSignups: 0,
				hasActiveAttributionFilters: false,
			}),
		);

		expect(acquisitionCostCoverageTooltip).toBe(
			"needs cost data for every month in range",
		);
		expect(html).toContain('data-state="incomplete"');
		expect(html).toContain("Coverage incomplete");
		expect(html).toContain('href="/costs"');
	});

	it("adds null-safe per-source CAC to the acquisition table", () => {
		const html = renderAnalytics(
			createElement(AcquisitionAnalyticsTables, {
				sources: [
					{
						source: "organic_search",
						signups: 10,
						activated: 8,
						paid: 2,
						signupToPaidPct: 20,
						mrrCents: 5_000,
						adSpendCents: 5_000,
						cacCents: 2_500,
					},
					{
						source: "direct",
						signups: 3,
						activated: 1,
						paid: 0,
						signupToPaidPct: 0,
						mrrCents: 0,
						adSpendCents: 0,
						cacCents: null,
					},
				],
				campaigns: [],
				countries: [],
				costCoverageComplete: true,
				hasActiveAttributionFilters: false,
			}),
		);

		expect(html).toContain("customer acquisition cost");
		expect(html).toContain(">CAC<");
		expect(html).toContain("Organic search");
		expect(html).toContain("$25");
		expect(html).toContain("—");
	});
});
