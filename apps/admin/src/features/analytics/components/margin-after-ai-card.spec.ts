import type { AdminAnalyticsMarginAfterAiRow } from "@wandit/contracts";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
	MarginAfterAiCard,
	orderMarginAfterAiRows,
} from "@/features/analytics/components/margin-after-ai-card";

function renderAnalytics(element: ReactElement) {
	return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

const starterRow: AdminAnalyticsMarginAfterAiRow = {
	plan: "starter",
	revenueCents: 800,
	aiCostCents: 200,
	marginCents: 600,
	marginPct: 75,
};

const proRow: AdminAnalyticsMarginAfterAiRow = {
	plan: "pro",
	revenueCents: 9_900,
	aiCostCents: 3_150,
	marginCents: 6_750,
	marginPct: 68.2,
};

const businessRow: AdminAnalyticsMarginAfterAiRow = {
	plan: "business",
	revenueCents: 2_601,
	aiCostCents: 4_100,
	marginCents: -1_499,
	marginPct: -57.6,
};

const freeRow: AdminAnalyticsMarginAfterAiRow = {
	plan: "free",
	revenueCents: 0,
	aiCostCents: 1_875,
	marginCents: -1_875,
	marginPct: null,
};

const marginAfterAi = [starterRow, proRow, businessRow, freeRow];

describe("margin after AI card", () => {
	it("keeps the starter, pro, business, free order and fills missing plans with zeros", () => {
		const rows = orderMarginAfterAiRows([freeRow, proRow]);

		expect(rows.map((row) => row.plan)).toEqual([
			"starter",
			"pro",
			"business",
			"free",
		]);
		expect(rows[0]).toEqual({
			plan: "starter",
			revenueCents: 0,
			aiCostCents: 0,
			marginCents: 0,
			marginPct: null,
		});
		expect(rows[2]).toEqual({
			plan: "business",
			revenueCents: 0,
			aiCostCents: 0,
			marginCents: 0,
			marginPct: null,
		});
	});

	it("renders every plan row, the method note, and the totals", () => {
		const html = renderAnalytics(
			createElement(MarginAfterAiCard, { marginAfterAi }),
		);

		expect(html).toContain("Margin after AI");
		expect(html).toContain("Shared infrastructure bills are not allocated");
		expect(html).toContain(">Starter<");
		expect(html).toContain(">Pro<");
		expect(html).toContain(">Business<");
		expect(html).toContain(">Free<");
		expect(html).toContain("$99");
		expect(html).toContain("$31.5");
		expect(html).toContain("68.2%");
		expect(html).toContain("All plans");
		expect(html).toContain("$133.01");
	});

	it("marks negative margins and shows an em dash for a null margin percentage", () => {
		const html = renderAnalytics(
			createElement(MarginAfterAiCard, { marginAfterAi }),
		);

		expect(html).toContain("text-destructive");
		expect(html).toContain("-$14.99");
		expect(html).toContain("—");
	});
});
