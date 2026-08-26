import type { AdminFeedbackActivity } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	activityLabel,
	formatViewport,
	pageLabelFromUrl,
	parseUserAgent,
	safeHttpUrl,
} from "./feedback-context";

const item = {
	context: {
		pageUrl: "https://wandit.dev/academy/getting-started",
	},
};

function makeActivity(
	overrides: Partial<AdminFeedbackActivity>,
): AdminFeedbackActivity {
	return {
		id: "f5a198b8-6fba-4f99-848b-56f103849280",
		kind: "received",
		fromValue: null,
		toValue: null,
		actor: null,
		createdAt: "2026-08-25T10:00:00.000Z",
		...overrides,
	};
}

describe("parseUserAgent", () => {
	it.each([
		{
			userAgent:
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
			expected: { browser: "Edge 138", device: "Windows 10/11" },
		},
		{
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36",
			expected: { browser: "Chrome 138", device: "macOS 15.6" },
		},
		{
			userAgent:
				"Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0",
			expected: { browser: "Firefox 141", device: "Linux" },
		},
		{
			userAgent:
				"Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
			expected: { browser: "Safari 18", device: "iOS 18.6" },
		},
		{
			userAgent:
				"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/138.0.0.0 Mobile Safari/537.36",
			expected: { browser: "Chrome 138", device: "Android 14" },
		},
	])("parses $expected.browser and $expected.device", ({
		userAgent,
		expected,
	}) => {
		expect(parseUserAgent(userAgent)).toEqual(expected);
	});

	it("normalizes older macOS version separators", () => {
		expect(
			parseUserAgent(
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15",
			),
		).toEqual({ browser: "Safari 18", device: "macOS 10.15.7" });
	});

	it("uses explicit unknown labels for unrecognized and absent metadata", () => {
		expect(parseUserAgent("CustomAgent/1.0")).toEqual({
			browser: "Unknown browser",
			device: "Unknown device",
		});
		expect(parseUserAgent(null)).toEqual({
			browser: "Unknown",
			device: "Unknown",
		});
	});
});

describe("pageLabelFromUrl", () => {
	it.each([
		["https://wandit.dev/p/f5a198b8-6fba-4f99-848b-56f103849280", "Workspace"],
		["https://wandit.dev/dashboard", "Dashboard"],
		["https://wandit.dev/academy/getting-started", "Academy"],
		["https://wandit.dev/pricing", "Pricing"],
		["https://wandit.dev/onboarding", "Onboarding"],
		["https://wandit.dev/apps", "Apps"],
		["https://wandit.dev/affiliates", "Affiliates"],
		["https://wandit.dev/workspace/billing", "Workspace settings"],
		["https://wandit.dev/", "Home"],
	])("labels %s as %s", (pageUrl, expected) => {
		expect(pageLabelFromUrl(pageUrl)).toBe(expected);
	});

	it("returns an unrecognized pathname and preserves an invalid URL", () => {
		expect(
			pageLabelFromUrl("https://wandit.dev/settings/profile?tab=team"),
		).toBe("/settings/profile");
		expect(pageLabelFromUrl("not a valid URL")).toBe("not a valid URL");
	});
});

describe("safeHttpUrl", () => {
	it.each([
		["javascript:alert(1)", null],
		["data:text/html,<script>alert(1)</script>", null],
		["not a valid URL", null],
		[
			"https://wandit.dev/academy/getting-started",
			"https://wandit.dev/academy/getting-started",
		],
	])("returns the safe URL for %s", (value, expected) => {
		expect(safeHttpUrl(value)).toBe(expected);
	});
});

describe("formatViewport", () => {
	it("formats dimensions with a multiplication sign", () => {
		expect(formatViewport({ width: 1512, height: 982 })).toBe("1512 × 982");
		expect(formatViewport(null)).toBeNull();
	});
});

describe("activityLabel", () => {
	it("labels a received activity with its submission page", () => {
		expect(activityLabel(makeActivity({}), item)).toEqual({
			label: "Feedback received",
			description: "Submitted from Academy",
			tone: "accent",
		});
	});

	it("labels resolved status changes as successful", () => {
		expect(
			activityLabel(
				makeActivity({
					kind: "status_changed",
					fromValue: "reviewing",
					toValue: "resolved",
					actor: { id: "admin-1", name: "Nadia" },
				}),
				item,
			),
		).toEqual({
			label: "Marked resolved",
			description: "Nadia changed the status from Reviewing to Resolved",
			tone: "success",
		});
	});

	it("uses the deleted-actor fallback for other status changes", () => {
		expect(
			activityLabel(
				makeActivity({
					kind: "status_changed",
					fromValue: "new",
					toValue: "planned",
				}),
				item,
			),
		).toEqual({
			label: "Moved to Planned",
			description: "A team member changed the status from New to Planned",
			tone: "default",
		});
	});

	it("describes priority and note changes", () => {
		expect(
			activityLabel(
				makeActivity({
					kind: "priority_changed",
					fromValue: "medium",
					toValue: "urgent",
					actor: { id: "admin-1", name: "Nadia" },
				}),
				item,
			),
		).toEqual({
			label: "Priority changed",
			description: "Nadia changed the priority from Medium to Urgent",
			tone: "default",
		});
		expect(activityLabel(makeActivity({ kind: "note_updated" }), item)).toEqual(
			{
				label: "Internal note updated",
				description: "A team member edited the internal note",
				tone: "default",
			},
		);
	});
});
