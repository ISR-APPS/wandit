import { describe, expect, it } from "vitest";

import type { FeedbackStats } from "@/features/feedback/api/feedback.dto";

import { countFeedbackByStatus, formatFeedbackRelativeTime } from "./feedback";

const stats: FeedbackStats = {
	total: 12,
	byStatus: {
		new: 4,
		reviewing: 3,
		planned: 2,
		resolved: 3,
	},
	openBugs: 3,
	highPriorityOpen: 5,
	resolvedLast7Days: 2,
};

describe("countFeedbackByStatus", () => {
	it("reads total and status counts from server stats", () => {
		expect(countFeedbackByStatus(stats, "all")).toBe(12);
		expect(countFeedbackByStatus(stats, "reviewing")).toBe(3);
	});

	it("returns zero before stats load", () => {
		expect(countFeedbackByStatus(undefined, "all")).toBe(0);
		expect(countFeedbackByStatus(undefined, "new")).toBe(0);
	});
});

describe("formatFeedbackRelativeTime", () => {
	it("uses the injected clock for deterministic relative labels", () => {
		const now = Date.parse("2026-08-25T12:00:00.000Z");

		expect(formatFeedbackRelativeTime("2026-08-25T11:42:00.000Z", now)).toBe(
			"18m ago",
		);
		expect(formatFeedbackRelativeTime("2026-08-23T12:00:00.000Z", now)).toBe(
			"2d ago",
		);
	});
});
