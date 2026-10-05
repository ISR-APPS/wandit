// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { CloudFunction } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import { FunctionsPanel } from "./functions-panel";

const PROJECT_ID = crypto.randomUUID();

const SEND_EMAIL: CloudFunction = {
	id: "fn-send-email",
	slug: "send-email",
	name: "send-email",
	status: "ACTIVE",
	version: 3,
	lastDeployedAt: "2026-10-02T09:30:00.000Z",
	invocations24h: 1234,
};

const RESIZE_IMAGE: CloudFunction = {
	...SEND_EMAIL,
	id: "fn-resize-image",
	slug: "resize-image",
	name: "resize-image",
	status: "THROTTLED",
	invocations24h: 0,
};

// The cache holds the list and nothing is stale or retried, so the panel
// never calls the API.
function clientWithFunctions(functions: CloudFunction[]): QueryClient {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
	queryClient.setQueryData(cloudKeys.functions(PROJECT_ID), functions);
	return queryClient;
}

function renderPanel(queryClient: QueryClient) {
	const onViewLogs = vi.fn<(slug: string) => void>();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(FunctionsPanel, {
			projectId: PROJECT_ID,
			isActive: true,
			onViewLogs,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
	return { onViewLogs };
}

afterEach(cleanup);

describe("FunctionsPanel", () => {
	it("shows the slug, the status, and the calls of 24 hours of each function", () => {
		renderPanel(clientWithFunctions([SEND_EMAIL, RESIZE_IMAGE]));

		const row = within(screen.getByRole("row", { name: /send-email/ }));
		expect(row.getByText("ACTIVE")).toBeTruthy();
		expect(row.getByText("1,234")).toBeTruthy();
		expect(
			within(screen.getByRole("row", { name: /resize-image/ })).getByText(
				"THROTTLED",
			),
		).toBeTruthy();
	});

	it("opens the logs of the function of the clicked row", () => {
		const { onViewLogs } = renderPanel(
			clientWithFunctions([SEND_EMAIL, RESIZE_IMAGE]),
		);

		fireEvent.click(
			within(screen.getByRole("row", { name: /resize-image/ })).getByRole(
				"button",
				{ name: "View logs" },
			),
		);

		expect(onViewLogs).toHaveBeenCalledExactlyOnceWith("resize-image");
	});

	it("shows the empty message when the app has no functions", () => {
		renderPanel(clientWithFunctions([]));

		expect(
			screen.getByText(
				"Your app has no Edge Functions yet. Ask the agent to add one.",
			),
		).toBeTruthy();
	});
});
