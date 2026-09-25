// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import type { PhoneDevice } from "../../lib/constants";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { PhonePreview, type PhonePreviewProps } from "./phone-preview";

const project: AppProject = {
	id: "nadi-fitness-mobile",
	name: "Nadi Fitness",
	slug: "nadi",
	description: "Membership app for a gym in Oran.",
	kind: "mobile",
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

async function renderPreview(device: PhoneDevice) {
	const props: PhonePreviewProps = {
		project,
		device,
		reloadKey: 0,
		bootContext: idleBoot,
		deps: readyDeps,
	};
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(PhonePreview, props),
	};
	render(createElement(I18nProvider, providerProps));
	return screen.findByTitle("Preview of Nadi Fitness");
}

afterEach(cleanup);

describe("PhonePreview", () => {
	it("labels the iPhone and puts the app iframe inside the frame", async () => {
		const iframe = await renderPreview("ios");
		expect(screen.getByText("iPhone 15 · iOS 17")).toBeTruthy();
		expect(screen.queryByText("Pixel 8 · Android 14")).toBeNull();
		expect(iframe).toBeTruthy();
	});

	it("labels the Pixel on the android device", async () => {
		await renderPreview("android");
		expect(screen.getByText("Pixel 8 · Android 14")).toBeTruthy();
		expect(screen.queryByText("iPhone 15 · iOS 17")).toBeNull();
	});
});
