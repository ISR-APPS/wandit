// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
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

// No turn runs and the backend is unknown: the boot screen has nothing to show over the frame.
const idleBoot: BootContext = {
	isTurnRunning: false,
	turnPhase: null,
	lastTurnFailed: false,
	isFirstTurn: false,
	backend: undefined,
};

async function renderPreview(viewport: WebViewport) {
	const props: WebPreviewProps = {
		project,
		viewport,
		reloadKey: 0,
		bootContext: idleBoot,
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
	const iframe = await screen.findByTitle("Preview of Nadi Fitness");
	// The width and the borders sit on the panel box that holds the iframe and the boot screen.
	const panel = iframe.parentElement;
	if (panel === null) throw new Error("The iframe has no panel box.");
	return panel;
}

afterEach(cleanup);

describe("WebPreview", () => {
	it("shows the project URL in the browser bar", async () => {
		await renderPreview("desktop");
		expect(screen.getByText("nadi.wandit.app")).toBeTruthy();
	});

	it("fills the width without side borders on the desktop viewport", async () => {
		const panel = await renderPreview("desktop");
		expect(panel.style.width).toBe("");
		expect(panel.className).toContain("border-0");
		expect(panel.className).not.toContain("border-x");
	});

	it("narrows the panel to 768 px on the tablet viewport", async () => {
		const panel = await renderPreview("tablet");
		expect(panel.style.width).toBe("768px");
		expect(panel.style.maxWidth).toBe("100%");
		expect(panel.className).toContain("border-x");
		expect(panel.className).not.toContain("border-0");
	});

	it("narrows the panel to 393 px with side borders on the mobile viewport", async () => {
		const panel = await renderPreview("mobile");
		expect(panel.style.width).toBe("393px");
		expect(panel.style.maxWidth).toBe("100%");
		expect(panel.className).toContain("border-x");
		expect(panel.className).not.toContain("border-0");
	});
});
