// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { Project } from "../api/dto";
import { projectTileGlyph, shouldShowProjectPreview } from "../lib/helpers";
import { PlatformBadge } from "./project-card";

function renderPlatformBadge(platform: Project["targetPlatform"]) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(PlatformBadge, { platform }),
	};
	return render(createElement(I18nProvider, providerProps));
}

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

describe("project card tile letter", () => {
	// A name can start with a bracket, a space, or an emoji. The tile still shows a letter.
	it.each([
		["[S1] chat", "S"],
		["  booking app", "B"],
		["🍕 Pizza order", "P"],
		["تطبيق حجز", "ت"],
		["2048 clone", "2"],
		["[ ] —", "✦"],
	])("%s gives %s", (name, glyph) => {
		expect(projectTileGlyph(name)).toBe(glyph);
	});
});

describe("PlatformBadge", () => {
	afterEach(cleanup);

	it("names the platform of a V2 project", () => {
		renderPlatformBadge("mobile");

		expect(screen.getByText("Mobile app")).toBeTruthy();
	});

	it("shows nothing for a V1 page project", () => {
		const { container } = renderPlatformBadge(null);

		expect(container.textContent).toBe("");
	});
});
