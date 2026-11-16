import { describe, expect, it } from "vitest";

import { createAppProjectFromStarterTemplateRequestSchema } from "./projects";

describe("createAppProjectFromStarterTemplateRequestSchema", () => {
	// The API puts the id in the archive path `templates/starter-<id>.tar.gz`,
	// and the web puts it in an image URL. A path character must not pass.
	it.each([
		["a parent folder", "../web-app", false],
		["a slash", "crm/pro", false],
		["a dot", "crm.tar", false],
		["an uppercase letter", "Crm", false],
		["a hyphen at the start", "-crm", false],
		["two hyphens together", "crm--pro", false],
		["a line break after a good id", "crm\n", false],
		["41 characters", "a".repeat(41), false],
		["no character", "", false],
		["kebab-case and 40 characters", `crm-${"a".repeat(36)}`, true],
	])("checks an id with %s", (_label, starterTemplateId, isAccepted) => {
		const parsed = createAppProjectFromStarterTemplateRequestSchema.safeParse({
			locale: "en",
			starterTemplateId,
		});

		expect(parsed.success).toBe(isAccepted);
	});
});
