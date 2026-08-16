import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AdsAnalyticsCard } from "@/features/analytics/components/ads-analytics-card";
import { FunnelStepVisualization } from "@/features/analytics/components/funnel-step-visualization";
import {
	SentryLinksCard,
	sentryProjectLinks,
} from "@/features/analytics/components/sentry-links-card";

function renderAnalytics(element: ReactElement) {
	return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

describe("Phase 3 analytics cards", () => {
	it("renders ads analysis, launch, error rates, and connected-user reach", () => {
		const html = renderAnalytics(
			createElement(AdsAnalyticsCard, {
				ads: {
					analysis: { events: 128, users: 37, errorRatePct: 2.5 },
					launch: { events: 12, users: 8, errorRatePct: null },
					connectedUsers: 25,
					totalUsers: 200,
					connectedPct: 12.5,
				},
			}),
		);

		expect(html).toContain('data-state="data"');
		expect(html).toContain("Users with connected ads accounts");
		expect(html).toContain("25 of 200 users");
		expect(html).toContain("Analysis");
		expect(html).toContain("Launch");
		expect(html).toContain("2.5%");
		expect(html).toContain("12.5%");
		expect(html).toContain("—");
	});

	it("renders pricing and upgrade counts as normal funnel steps", () => {
		const html = renderAnalytics(
			createElement(FunnelStepVisualization, {
				steps: [
					{ key: "visitor", count: 100, pctOfPrevious: null },
					{ key: "signup", count: 80, pctOfPrevious: 80 },
					{ key: "firstAction", count: 60, pctOfPrevious: 75 },
					{ key: "activated", count: 50, pctOfPrevious: 83.3 },
					{ key: "healthyTrial", count: 40, pctOfPrevious: 80 },
					{ key: "pricingViewed", count: 20, pctOfPrevious: 50 },
					{ key: "upgradeClicked", count: 10, pctOfPrevious: 50 },
					{ key: "checkoutStarted", count: 5, pctOfPrevious: 50 },
					{ key: "paid", count: 2, pctOfPrevious: 40 },
				],
			}),
		);

		expect(html).toContain('aria-label="Pricing viewed: 20"');
		expect(html).toContain('aria-label="Upgrade clicked: 10"');
		expect(html).not.toContain("No data until Phase 3");
		expect(html).not.toContain(">Unavailable<");
	});

	it("links every Sentry project and the MCP connector filter in a new tab", () => {
		const html = renderAnalytics(createElement(SentryLinksCard));
		const serverLink = sentryProjectLinks[0];

		expect(sentryProjectLinks.map((project) => project.href)).toEqual([
			"https://wandit.sentry.io/issues/?project=wandit-server&query=is%3Aunresolved&statsPeriod=7d",
			"https://wandit.sentry.io/issues/?project=wandit-admin&query=is%3Aunresolved&statsPeriod=7d",
			"https://wandit.sentry.io/issues/?project=wandit-web&query=is%3Aunresolved&statsPeriod=7d",
			"https://wandit.sentry.io/issues/?project=wandit-edge&query=is%3Aunresolved&statsPeriod=7d",
		]);
		expect(serverLink.connectorHref).toContain("connectorSlug%3A*");
		expect(html.match(/target="_blank"/g)).toHaveLength(5);
		expect(html).toContain("MCP connector errors");
		expect(html).toContain("Live error rates need a runtime Sentry API token.");
	});
});
