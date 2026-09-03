import { describe, expect, it } from "vitest";

import {
	formatCentiCredits,
	formatConversationRelativeTime,
	formatConversationTokenCount,
} from "./conversation-formatters";

const now = Date.parse("2026-08-31T12:00:00.000Z");

describe("formatConversationRelativeTime", () => {
	it("handles missing and invalid timestamps safely", () => {
		expect(formatConversationRelativeTime(null, now)).toBe("No activity");
		expect(formatConversationRelativeTime("not-a-date", now)).toBe(
			"No activity",
		);
	});

	it("labels current timestamps as just now", () => {
		expect(
			formatConversationRelativeTime("2026-08-31T12:00:00.000Z", now),
		).toBe("Just now");
	});

	it("formats elapsed minutes", () => {
		expect(
			formatConversationRelativeTime("2026-08-31T11:42:00.000Z", now),
		).toBe("18m ago");
	});

	it("formats elapsed hours", () => {
		expect(
			formatConversationRelativeTime("2026-08-31T09:00:00.000Z", now),
		).toBe("3h ago");
	});

	it("formats elapsed days", () => {
		expect(
			formatConversationRelativeTime("2026-08-28T12:00:00.000Z", now),
		).toBe("3d ago");
	});

	it("formats elapsed weeks through the first month", () => {
		expect(
			formatConversationRelativeTime("2026-08-10T12:00:00.000Z", now),
		).toBe("3w ago");
	});

	it("uses a medium absolute date after five weeks", () => {
		expect(
			formatConversationRelativeTime("2026-07-01T12:00:00.000Z", now),
		).toBe("Jul 1, 2026");
	});
});

describe("conversation usage formatters", () => {
	it("formats token counts compactly", () => {
		expect(formatConversationTokenCount(null)).toBe("—");
		expect(formatConversationTokenCount(12_345)).toBe("12.3k");
		expect(formatConversationTokenCount(1_250_000)).toBe("1.3m");
	});

	it("converts centi-credits to fixed two-decimal credits", () => {
		expect(formatCentiCredits(null)).toBe("—");
		expect(formatCentiCredits(1)).toBe("0.01");
		expect(formatCentiCredits(12_345)).toBe("123.45");
		expect(formatCentiCredits(1_234_550)).toBe("12,345.50");
	});
});
