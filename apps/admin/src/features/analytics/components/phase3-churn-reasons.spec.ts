import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
	ChurnBreakdownCard,
	formatCancellationReason,
} from "@/features/analytics/components/churn-breakdown-card";

describe("Phase 3 churn reason breakdown", () => {
	it("labels pre-survey churn explicitly", () => {
		expect(formatCancellationReason("unknown")).toBe("Unknown (pre-survey)");
		expect(formatCancellationReason("missing_features")).toBe(
			"Missing Features",
		);
	});

	it("renders churn grouped by cancellation reason", () => {
		const html = renderToStaticMarkup(
			createElement(
				TooltipProvider,
				null,
				createElement(ChurnBreakdownCard, {
					breakdown: {
						byPlan: [],
						bySource: [],
						byReason: [
							{ reason: "unknown", churned: 3 },
							{ reason: "too_expensive", churned: 2 },
						],
						byCountry: [],
						byFeature: [],
					},
				}),
			),
		);

		expect(html).toContain("By reason");
		expect(html).toContain("Unknown (pre-survey)");
		expect(html).toContain("Too Expensive");
		expect(html).toContain(">3<");
		expect(html).not.toContain("No churn recorded in this range");
	});
});
