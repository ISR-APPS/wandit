import { describe, expect, it } from "vitest";

import { formatConversationRelativeTime } from "./conversation-formatters";

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
