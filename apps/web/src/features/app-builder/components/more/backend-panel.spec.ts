// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetMockStore } from "../../api/app-builder.services";
import { BackendPanel } from "./backend-panel";

function renderPanel() {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			Suspense,
			{ fallback: null },
			createElement(BackendPanel, { projectId: "nadi-fitness" }),
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

describe("BackendPanel", () => {
	it("renders the table rows and the table count after the summary loads", async () => {
		renderPanel();
		expect(await screen.findByText("members")).toBeTruthy();
		expect(screen.getByText("5 tables")).toBeTruthy();
		expect(screen.getByText("312 rows")).toBeTruthy();
	});

	it("formats the big numbers for the locale", async () => {
		renderPanel();
		expect(await screen.findByText("10,491 rows · 38 MB")).toBeTruthy();
		expect(screen.getByText("2,104 calls today")).toBeTruthy();
		expect(screen.getByText("1,870 today")).toBeTruthy();
	});
});
