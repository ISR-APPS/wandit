import { describe, expect, it } from "vitest";

import { shouldShowProjectPreview } from "../lib/helpers";

describe("project card thumbnail", () => {
	it("retries when the preview URL changes after a failure", () => {
		const failedUrl = "https://cdn.example/thumbnail-v1.jpg";

		expect(shouldShowProjectPreview(failedUrl, failedUrl)).toBe(false);
		expect(
			shouldShowProjectPreview(
				"https://cdn.example/thumbnail-v2.jpg",
				failedUrl,
			),
		).toBe(true);
	});

	it("does not render a preview without a URL", () => {
		expect(shouldShowProjectPreview(null, null)).toBe(false);
	});
});
