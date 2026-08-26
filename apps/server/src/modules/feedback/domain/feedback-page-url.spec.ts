import { describe, expect, it } from "vitest";

import { projectIdFromPageUrl } from "./feedback-page-url";

const PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("projectIdFromPageUrl", () => {
	it("extracts a project id from the workspace route", () => {
		expect(projectIdFromPageUrl(`https://app.wandit.dev/p/${PROJECT_ID}`)).toBe(
			PROJECT_ID,
		);
	});

	it("accepts a nested path below the workspace route", () => {
		expect(
			projectIdFromPageUrl(
				`https://app.wandit.dev/p/${PROJECT_ID}/settings?tab=members`,
			),
		).toBe(PROJECT_ID);
	});

	it("rejects another route and an invalid project id", () => {
		expect(
			projectIdFromPageUrl(`https://app.wandit.dev/projects/${PROJECT_ID}`),
		).toBeNull();
		expect(
			projectIdFromPageUrl(
				"https://app.wandit.dev/p/550e8400-e29b-41d4-a716-not-a-uuid",
			),
		).toBeNull();
	});

	it("returns null for an invalid URL", () => {
		expect(projectIdFromPageUrl("not a URL")).toBeNull();
	});
});
