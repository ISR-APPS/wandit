// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import type { CloudPanel } from "../../lib/constants";
import { CloudPanelContent } from "./cloud-panel-content";

const PROJECT_ID = crypto.randomUUID();

// The cache holds every answer a case puts in it, and nothing is stale or
// retried, so the panel never calls the API for that data.
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

function renderContent(
	panel: CloudPanel,
	isActive: boolean,
	queryClient = cachedClient(),
) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(CloudPanelContent, {
			projectId: PROJECT_ID,
			isActive,
			panel,
			logsFilter: undefined,
			onViewFunctionLogs: vi.fn(),
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
	return { queryClient };
}

afterEach(cleanup);

// more-view.spec.ts covers the View logs path from Functions to Logs.
describe("CloudPanelContent", () => {
	it("opens the Secrets panel without a backend read", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.secrets(PROJECT_ID), []);
		renderContent("secrets", true, queryClient);

		expect(screen.getByText("This project has no secrets yet.")).toBeTruthy();
		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID)),
		).toBeUndefined();
	});

	it("reads no backend state while the More view is hidden", () => {
		const { queryClient } = renderContent("database", false);

		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID))?.fetchStatus,
		).toBe("idle");
	});
});
