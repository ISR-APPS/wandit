// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import type { MobilePreviewTarget } from "../../lib/constants";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { PhonePreview, type PhonePreviewProps } from "./phone-preview";

const project: AppProject = {
	id: "nadi-fitness-mobile",
	name: "Nadi Fitness",
	kind: "mobile",
	languages: ["en"],
	templateVersion: "1.0.0",
	engine: "v2_app",
	versionNumber: 4,
	unpublishedChanges: 3,
	hasCodeChanges: true,
};

// The fake answers one minted URL, so no network call happens.
const readyDeps: PreviewTokenDeps = {
	getPreviewToken: async () => ({
		token: "t1",
		previewUrl:
			"https://r-abcdef123456--p-nadi-fitness-mobile.wanditpreview.app/?wt=t1",
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
	hasCodeChanges: true,
};

// jsdom has no ResizeObserver; the stage measures itself with one.
class ResizeObserverStub implements ResizeObserver {
	disconnect() {}
	observe() {}
	takeRecords(): ResizeObserverEntry[] {
		return [];
	}
	unobserve() {}
}

async function renderPreview(
	target: MobilePreviewTarget,
	canRunOnDevice = false,
) {
	const props: PhonePreviewProps = {
		project,
		target,
		onChangeTarget: () => {},
		reloadKey: 0,
		onReload: () => {},
		bootContext: idleBoot,
		canRunOnDevice,
		deps: readyDeps,
	};
	// The page mounts one TooltipProvider; the bar buttons need it too.
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			TooltipProvider,
			null,
			createElement(PhonePreview, props),
		),
	};
	// The wake button of the boot screen needs a query client.
	render(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(I18nProvider, providerProps),
		),
	);
	return screen.findByTitle("Preview of Nadi Fitness");
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("PhonePreview", () => {
	it("gives a mobile app reload and Expo Go but no live app link, shows the target switch only behind its flag, and a device waits for its turn-on button", async () => {
		// Without the flag, a `?device=ios` URL falls back to the web build.
		await renderPreview("ios");
		expect(screen.queryByRole("button", { name: "Android" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Reload the preview" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Test on your phone" }),
		).toBeTruthy();
		// A mobile app has no site, so the bar has no live app link.
		expect(
			screen.queryByRole("link", { name: "Open the live app" }),
		).toBeNull();
		cleanup();

		// Each device minute costs money: no stream mounts before the click.
		await renderPreview("ios", true);
		expect(screen.getByRole("button", { name: "Android" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Turn on" })).toBeTruthy();
		expect(screen.queryByTitle("iOS device with Nadi Fitness")).toBeNull();
	});
});
