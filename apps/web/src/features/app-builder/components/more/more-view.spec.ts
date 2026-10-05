// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CloudBackendResponse, CloudFunction } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import type { AppProject } from "../../api/dto";
import type { ProjectPanel } from "../../lib/constants";
import { MoreView } from "./more-view";

const PROJECT: AppProject = {
	id: crypto.randomUUID(),
	name: "Nadi Fitness",
	kind: "web",
	languages: ["en"],
	templateVersion: "1.0.0",
	engine: "v2_app",
	versionNumber: 4,
	unpublishedChanges: 3,
	hasCodeChanges: true,
};

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
// retried, so the view never calls the API for that data.
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

function renderView(
	panel: ProjectPanel,
	isActive: boolean,
	queryClient = cachedClient(),
) {
	const onSelectPanel = vi.fn();
	function view(openPanel: ProjectPanel, isViewActive: boolean) {
		// I18nProvider requires children in its props type for createElement calls.
		const providerProps: ComponentProps<typeof I18nProvider> = {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(MoreView, {
				project: PROJECT,
				panel: openPanel,
				isActive: isViewActive,
				showBackendGroup: true,
				onSelectPanel,
			}),
		};
		return createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(
				TooltipProvider,
				null,
				createElement(I18nProvider, providerProps),
			),
		);
	}
	const { rerender } = render(view(panel, isActive));
	// The page owns the open panel, so a case shows another panel with a new render.
	function showPanel(nextPanel: ProjectPanel, isViewActive: boolean): void {
		rerender(view(nextPanel, isViewActive));
	}
	return { queryClient, onSelectPanel, showPanel };
}

/** The `query` part of every logs query key in the cache, in creation order. */
function logsQueries(queryClient: QueryClient) {
	return queryClient
		.getQueryCache()
		.findAll({ queryKey: [...cloudKeys.all(PROJECT.id), "logs"] })
		.map((query) => query.queryKey.at(-1));
}

afterEach(cleanup);

describe("MoreView", () => {
	it("opens a More panel inside its shell, with the panel title", () => {
		renderView("payments", true);

		expect(
			screen.getByRole("heading", { level: 1, name: "Payments" }),
		).toBeTruthy();
		expect(screen.getByText("Payments are coming soon")).toBeTruthy();
	});

	it("opens a Cloud panel in the shell, with its Cloud title", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.secrets(PROJECT.id), []);
		renderView("secrets", true, queryClient);

		expect(screen.getByText("This project has no secrets yet.")).toBeTruthy();
		expect(
			screen.getByRole("heading", { level: 1, name: "Secrets" }),
		).toBeTruthy();
	});

	it("opens Logs on the functions source and the slug from View logs", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.backend(PROJECT.id), ACTIVE_BACKEND);
		queryClient.setQueryData(cloudKeys.functions(PROJECT.id), [SEND_EMAIL]);
		const { onSelectPanel, showPanel } = renderView(
			"functions",
			true,
			queryClient,
		);

		fireEvent.click(screen.getByRole("button", { name: "View logs" }));

		expect(onSelectPanel).toHaveBeenCalledWith("logs");

		// A hidden view reads nothing, so the logs query enters the cache with no API call.
		showPanel("logs", false);

		expect(logsQueries(queryClient)).toHaveLength(1);
		expect(logsQueries(queryClient)[0]).toMatchObject({
			source: "functions",
			search: "send-email",
		});
	});

	it("clears the Logs filter on a nav click", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.backend(PROJECT.id), ACTIVE_BACKEND);
		queryClient.setQueryData(cloudKeys.functions(PROJECT.id), [SEND_EMAIL]);
		const { onSelectPanel, showPanel } = renderView(
			"functions",
			false,
			queryClient,
		);
		fireEvent.click(screen.getByRole("button", { name: "View logs" }));

		fireEvent.click(screen.getByRole("button", { name: "Logs" }));
		showPanel("logs", false);

		expect(onSelectPanel).toHaveBeenLastCalledWith("logs");
		expect(logsQueries(queryClient)).toEqual([
			expect.objectContaining({ source: "api", search: undefined }),
		]);
	});
});
