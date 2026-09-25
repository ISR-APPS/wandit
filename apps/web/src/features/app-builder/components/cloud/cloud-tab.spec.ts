// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import type { CloudPanel } from "../../lib/constants";
import { CloudTab } from "./cloud-tab";

const PROJECT_ID = crypto.randomUUID();

function renderTab(panel: CloudPanel, isActive: boolean) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const onSelectPanel = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(CloudTab, {
			projectId: PROJECT_ID,
			isActive,
			panel,
			onSelectPanel,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
	return { queryClient, onSelectPanel };
}

afterEach(cleanup);

describe("CloudTab", () => {
	it("lists every panel of the three slices and selects a clicked one", () => {
		const { onSelectPanel } = renderTab("database", false);

		expect(
			screen
				.getByRole("navigation", { name: "Cloud sections" })
				.querySelectorAll("button"),
		).toHaveLength(6);
		expect(
			screen
				.getByRole("button", { name: "Database" })
				.getAttribute("aria-current"),
		).toBe("page");

		fireEvent.click(screen.getByRole("button", { name: "Logs" }));

		expect(onSelectPanel).toHaveBeenCalledWith("logs");
	});

	it("shows a later panel as coming soon, with no backend read", () => {
		const { queryClient } = renderTab("storage", true);

		expect(
			screen.getByText(
				"This section is not ready yet. A later update adds it.",
			),
		).toBeTruthy();
		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID)),
		).toBeUndefined();
	});

	it("reads no backend state while the Cloud view is hidden", () => {
		const { queryClient } = renderTab("database", false);

		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID))?.fetchStatus,
		).toBe("idle");
	});
});
