// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { AppProject } from "../../api/dto";
import type { WebViewport } from "../../lib/constants";
import { WebPreview, type WebPreviewProps } from "./web-preview";

const project: AppProject = {
	id: "nadi-fitness",
	name: "Nadi Fitness",
	slug: "nadi",
	description: "Membership app for a gym in Oran.",
	kind: "web",
	versionNumber: 4,
	unpublishedChanges: 3,
};

function renderPreview(viewport: WebViewport) {
	const props: WebPreviewProps = { project, viewport, reloadKey: 0 };
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(WebPreview, props),
	};
	render(createElement(I18nProvider, providerProps));
	return screen.getByTitle("Preview of Nadi Fitness");
}

afterEach(cleanup);

describe("WebPreview", () => {
	it("shows the project URL in the browser bar", () => {
		renderPreview("desktop");
		expect(screen.getByText("nadi.wandit.app")).toBeTruthy();
		expect(screen.getByText("/admin")).toBeTruthy();
	});

	it("fills the width without side borders on the desktop viewport", () => {
		const iframe = renderPreview("desktop");
		expect(iframe.style.width).toBe("");
		expect(iframe.className).toContain("border-0");
		expect(iframe.className).not.toContain("border-x");
	});

	it("narrows the iframe to 393 px with side borders on the mobile viewport", () => {
		const iframe = renderPreview("mobile");
		expect(iframe.style.width).toBe("393px");
		expect(iframe.style.maxWidth).toBe("100%");
		expect(iframe.className).toContain("border-x");
		expect(iframe.className).not.toContain("border-0");
	});
});
