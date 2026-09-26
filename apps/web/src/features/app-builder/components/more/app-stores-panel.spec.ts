// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetMockStore } from "../../api/app-builder.services";
import type { AppProject } from "../../api/dto";
import { AppStoresPanel } from "./app-stores-panel";

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

function renderPanel() {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			Suspense,
			{ fallback: null },
			createElement(AppStoresPanel, { project }),
		),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(I18nProvider, providerProps),
		),
	);
}

beforeEach(resetMockStore);
afterEach(cleanup);

describe("AppStoresPanel", () => {
	it("counts the done listing items and marks the missing ones", async () => {
		renderPanel();
		expect(await screen.findByText("4 of 6 done")).toBeTruthy();
		// The privacy URL has no detail, so the row asks for it.
		expect(screen.getByText("Needed for review")).toBeTruthy();
		// The age rating has a detail even though it is not done.
		expect(screen.getByText("Health & Fitness")).toBeTruthy();
	});

	it("shows the iOS build with the project version and both store states", async () => {
		renderPanel();
		expect(await screen.findByText("12 · v4")).toBeTruthy();
		expect(screen.getByText("dz.nadi.app")).toBeTruthy();
		expect(screen.getByText("9 testers")).toBeTruthy();
		expect(screen.getByText("Ready to submit")).toBeTruthy();
		expect(screen.getByText("Not set up")).toBeTruthy();
	});
});
