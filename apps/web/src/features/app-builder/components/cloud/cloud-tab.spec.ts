// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CloudBackendResponse, CloudFunction } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import type { CloudPanel } from "../../lib/constants";
import { CloudTab } from "./cloud-tab";

const PROJECT_ID = crypto.randomUUID();

const ACTIVE_BACKEND: CloudBackendResponse = {
	status: "active",
	ref: "abcdefghijklmnopqrst",
	region: "eu-west-3",
	failureCode: null,
};

const SEND_EMAIL: CloudFunction = {
	id: "fn-send-email",
	slug: "send-email",
	name: "send-email",
	status: "ACTIVE",
	version: 3,
	lastDeployedAt: "2026-10-02T09:30:00.000Z",
	invocations24h: 12,
};

// The cache holds every answer a case puts in it, and nothing is stale or
// retried, so the tab never calls the API for that data.
function cachedClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
}

function renderTab(
	panel: CloudPanel,
	isActive: boolean,
	queryClient = cachedClient(),
) {
	const onSelectPanel = vi.fn();
	function tab(openPanel: CloudPanel, isViewActive: boolean) {
		// I18nProvider requires children in its props type for createElement calls.
		const providerProps: ComponentProps<typeof I18nProvider> = {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(CloudTab, {
				projectId: PROJECT_ID,
				isActive: isViewActive,
				panel: openPanel,
				onSelectPanel,
			}),
		};
		return createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		);
	}
	const { rerender } = render(tab(panel, isActive));
	// The page owns the open panel, so a case shows another panel with a new render.
	function showPanel(nextPanel: CloudPanel, isViewActive: boolean): void {
		rerender(tab(nextPanel, isViewActive));
	}
	return { queryClient, onSelectPanel, showPanel };
}

afterEach(cleanup);

describe("CloudTab", () => {
	it("lists the seven panels and selects a clicked one", () => {
		const { onSelectPanel } = renderTab("database", false);

		expect(
			screen
				.getByRole("navigation", { name: "Cloud sections" })
				.querySelectorAll("button"),
		).toHaveLength(7);
		expect(
			screen
				.getByRole("button", { name: "Database" })
				.getAttribute("aria-current"),
		).toBe("page");

		fireEvent.click(screen.getByRole("button", { name: "Logs" }));

		expect(onSelectPanel).toHaveBeenCalledWith("logs");
	});

	it("opens the Secrets panel without a backend read", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.secrets(PROJECT_ID), []);
		renderTab("secrets", true, queryClient);

		expect(screen.getByText("This project has no secrets yet.")).toBeTruthy();
		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID)),
		).toBeUndefined();
	});

	it("opens Logs on the functions source and the slug from View logs", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.backend(PROJECT_ID), ACTIVE_BACKEND);
		queryClient.setQueryData(cloudKeys.functions(PROJECT_ID), [SEND_EMAIL]);
		const { onSelectPanel, showPanel } = renderTab(
			"functions",
			true,
			queryClient,
		);

		fireEvent.click(screen.getByRole("button", { name: "View logs" }));

		expect(onSelectPanel).toHaveBeenCalledWith("logs");

		// A hidden view reads nothing, so the logs query enters the cache with no API call.
		showPanel("logs", false);

		const logsQueries = queryClient
			.getQueryCache()
			.findAll({ queryKey: [...cloudKeys.all(PROJECT_ID), "logs"] });
		expect(logsQueries).toHaveLength(1);
		expect(logsQueries[0]?.queryKey.at(-1)).toMatchObject({
			source: "functions",
			search: "send-email",
		});
	});

	it("reads no backend state while the Cloud view is hidden", () => {
		const { queryClient } = renderTab("database", false);

		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID))?.fetchStatus,
		).toBe("idle");
	});
});
