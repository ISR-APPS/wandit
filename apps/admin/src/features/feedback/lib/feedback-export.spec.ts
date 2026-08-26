import { describe, expect, it } from "vitest";

import type { FeedbackItem } from "@/features/feedback/api/feedback.dto";

import { buildFeedbackCsv } from "./feedback-export";

function makeFeedback(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
	return {
		id: "0a928d90-9af1-4f65-8d13-5d5379f762f7",
		title: 'A quoted "title"',
		message: "First line\nSecond line",
		category: "bug",
		status: "new",
		priority: "high",
		createdAt: "2026-08-25T10:00:00.000Z",
		updatedAt: "2026-08-25T10:00:00.000Z",
		resolvedAt: null,
		reporter: {
			id: "user-1",
			name: "Lovelace, Ada",
			email: "ada@example.com",
			image: null,
			plan: "pro",
			memberSince: "2026-01-01T00:00:00.000Z",
		},
		context: {
			pageUrl: "https://app.example.com/dashboard",
			replayUrl: null,
			sentryEventId: null,
			sentryEventAt: null,
			userAgent: null,
			viewport: null,
			locale: "en",
		},
		project: null,
		screenshotUrl: null,
		linear: null,
		adminNote: "",
		...overrides,
	};
}

describe("buildFeedbackCsv", () => {
	it("quotes commas, quotes, and newlines using RFC 4180 escaping", () => {
		const csv = buildFeedbackCsv([makeFeedback()]);

		expect(csv).toContain('"Lovelace, Ada"');
		expect(csv).toContain('"A quoted ""title"""');
		expect(csv).toContain('"First line\nSecond line"');
		expect(csv.endsWith("\r\n")).toBe(true);
	});

	it.each([
		["=SUM(A1:A2)", "'=SUM(A1:A2)"],
		["+SUM(A1:A2)", "'+SUM(A1:A2)"],
		["-SUM(A1:A2)", "'-SUM(A1:A2)"],
		["@SUM(A1:A2)", "'@SUM(A1:A2)"],
		["\t=SUM(A1:A2)", "'\t=SUM(A1:A2)"],
		["\r=SUM(A1:A2)", `"'\r=SUM(A1:A2)"`],
	])("neutralizes formula-capable CSV cells starting with %j", (title, safeTitle) => {
		const csv = buildFeedbackCsv([makeFeedback({ title })]);

		expect(csv).toContain(safeTitle);
	});
});
