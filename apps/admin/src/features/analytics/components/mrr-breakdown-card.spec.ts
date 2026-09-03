import type {
	AdminAnalyticsArpuByPlan,
	AdminAnalyticsMrrByPlan,
} from "@wandit/contracts";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { MrrBreakdownCard } from "@/features/analytics/components/mrr-breakdown-card";

function renderAnalytics(element: ReactElement) {
	return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

const items: AdminAnalyticsMrrByPlan[] = [
	{ plan: "starter", interval: "month", subscribers: 2, mrrMinor: 1_600 },
	{ plan: "starter", interval: "year", subscribers: 1, mrrMinor: 667 },
	{ plan: "pro", interval: "month", subscribers: 1, mrrMinor: 2_500 },
	{ plan: "business", interval: "year", subscribers: 1, mrrMinor: 4_167 },
];

const arpuByPlan: AdminAnalyticsArpuByPlan[] = [
	{ plan: "starter", arpuCents: 800 },
	{ plan: "pro", arpuCents: 2_500 },
	{ plan: "business", arpuCents: 5_000 },
];

describe("MRR breakdown card", () => {
	it("renders both Starter intervals in the legend, totals, and ARPU", () => {
		const html = renderAnalytics(
			createElement(MrrBreakdownCard, { arpuByPlan, items }),
		);

		expect(html).toContain("Starter · monthly");
		expect(html).toContain("Starter · annual");
		expect(html).toContain("Pro · monthly");
		expect(html).toContain("Business · annual");
		expect(html).toContain("2 subscribers");
		expect(html).toContain("Starter ARPU");
		expect(html).toContain("$89");
		expect(html).toContain("$8");
		expect(html).toContain("across Starter, Pro, and Business");
	});
});
