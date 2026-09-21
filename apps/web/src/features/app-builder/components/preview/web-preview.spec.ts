// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { AppProject } from "../../api/dto";
import type { WebViewport } from "../../lib/constants";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
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

// The fake answers one minted URL, so no network call happens.
const readyDeps: PreviewTokenDeps = {
	getPreviewToken: async () => ({
		token: "t1",
		previewUrl:
			"https://r-abcdef123456--p-nadi-fitness.wanditpreview.app/?wt=t1",
		// One hour out: the scheduled re-mint never fires during a spec run.
		expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
	}),
};

async function renderPreview(viewport: WebViewport) {
	const props: WebPreviewProps = {
		project,
		viewport,
		reloadKey: 0,
		deps: readyDeps,
	};
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(WebPreview, props),
	};
	render(createElement(I18nProvider, providerProps));
	return screen.findByTitle("Preview of Nadi Fitness");
}

afterEach(cleanup);

describe("WebPreview", () => {
	it("shows the project URL in the browser bar", async () => {
		await renderPreview("desktop");
		expect(screen.getByText("nadi.wandit.app")).toBeTruthy();
	});

	it("fills the width without side borders on the desktop viewport", async () => {
		const iframe = await renderPreview("desktop");
		expect(iframe.style.width).toBe("");
		expect(iframe.className).toContain("border-0");
		expect(iframe.className).not.toContain("border-x");
	});

	it("narrows the iframe to 768 px on the tablet viewport", async () => {
		const iframe = await renderPreview("tablet");
		expect(iframe.style.width).toBe("768px");
		expect(iframe.style.maxWidth).toBe("100%");
		expect(iframe.className).toContain("border-x");
		expect(iframe.className).not.toContain("border-0");
	});

	it("narrows the iframe to 393 px with side borders on the mobile viewport", async () => {
		const iframe = await renderPreview("mobile");
		expect(iframe.style.width).toBe("393px");
		expect(iframe.style.maxWidth).toBe("100%");
		expect(iframe.className).toContain("border-x");
		expect(iframe.className).not.toContain("border-0");
	});
});
