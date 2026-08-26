import { describe, expect, it } from "vitest";

import { feedbackTitle } from "./feedback-title";

describe("feedbackTitle", () => {
	it("collapses whitespace and trims the message", () => {
		expect(feedbackTitle("  The editor\n\tfreezes   here  ")).toBe(
			"The editor freezes here",
		);
	});

	it("keeps a title at the maximum length unchanged", () => {
		const message = "a".repeat(70);

		expect(feedbackTitle(message)).toBe(message);
	});

	it("truncates a longer title and adds an ellipsis", () => {
		expect(feedbackTitle("a".repeat(71))).toBe(`${"a".repeat(70)}…`);
	});
});
