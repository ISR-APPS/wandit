import { describe, expect, it } from "vitest";

import {
	createAppProjectFromStarterTemplateRequestSchema,
	createAppProjectRequestSchema,
} from "./projects";

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

describe("createAppProjectRequestSchema clone tag", () => {
	// `capture_site` exists only in a build turn of a web project. A clone tag
	// alone is a full request, but a search tag needs words.
	const clone = { kind: "clone_site", url: "https://stripe.com" } as const;
	it.each([
		["a clone tag alone on web", {}, clone, true],
		["a clone tag in Plan Mode", { mode: "plan" }, clone, false],
		["a clone tag on mobile", { targetPlatform: "mobile" }, clone, false],
		[
			"a clone tag of a local address",
			{},
			{ ...clone, url: "http://localhost:3000" },
			false,
		],
		["a web search tag alone", {}, { kind: "web_search" }, false],
	])("checks %s", (_label, extra, action, isAccepted) => {
		const parsed = createAppProjectRequestSchema.safeParse({
			action,
			languages: ["en"],
			prompt: "",
			...extra,
		});

		expect(parsed.success).toBe(isAccepted);
	});
});

describe("createAppProjectRequestSchema attachments", () => {
	// No builder model or agent tool opens video or audio, so the create refuses them.
	it.each([
		["image/png", true],
		["application/pdf", true],
		["video/mp4", false],
		["audio/mpeg", false],
	])("accepts a %s file: %s", (mediaType, isAccepted) => {
		const parsed = createAppProjectRequestSchema.safeParse({
			attachments: [
				{ mediaType, url: "https://assets.example.com/uploads/a/b/file" },
			],
			languages: ["en"],
			prompt: "",
		});

		expect(parsed.success).toBe(isAccepted);
	});
});
