// @vitest-environment jsdom

import {
	QueryClient,
	QueryClientProvider,
	type QueryKey,
} from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import {
	CLOUD_LOGS_PAGE_SIZE,
	type CloudLogEntry,
	type CloudLogLevel,
} from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import { type LogsFilter, LogsPanel } from "./logs-panel";

const PROJECT_ID = crypto.randomUUID();

// Date.now is pinned here, so the newest window ends at NOW.
const NOW = "2026-10-03T12:00:00.000Z";
const ONE_DAY_BEFORE = "2026-10-02T12:00:00.000Z";
const TWO_DAYS_BEFORE = "2026-10-01T12:00:00.000Z";

/** The logs key of the newest window of the `api` source, with no filter. */
const NEWEST_API_KEY = cloudKeys.logs(PROJECT_ID, {
	source: "api",
	start: ONE_DAY_BEFORE,
	end: NOW,
});

function logLine(index: number, level: CloudLogLevel): CloudLogEntry {
	return {
		id: `line-${index}`,
		timestamp: "2026-10-03T11:00:00.000Z",
		level,
		message: `GET /rest/v1/orders ${index}`,
	};
}

// The cache holds every answer and nothing is stale or retried, so the
// panel never calls the API.
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

// A hidden view reads nothing, so the cases that only check the key make
// no API call. The query still enters the cache with the key the panel asks for.
function renderPanel(
	queryClient: QueryClient,
	isActive: boolean,
	initialFilter?: LogsFilter,
) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(LogsPanel, {
			projectId: PROJECT_ID,
			isActive,
			initialFilter,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
}

/** The keys the panel reads now. keepPreviousData leaves an old key in the cache without an observer. */
function observedKeys(queryClient: QueryClient): QueryKey[] {
	return queryClient
		.getQueryCache()
		.getAll()
		.filter((query) => query.getObserversCount() > 0)
		.map((query) => query.queryKey);
}

beforeEach(() => {
	// Only Date is fake: React and TanStack still use the real timers.
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("LogsPanel", () => {
	it("reads the api source over the last 24 hours", () => {
		const queryClient = cachedClient();
		renderPanel(queryClient, false);

		expect(observedKeys(queryClient)).toEqual([NEWEST_API_KEY]);
	});

	it("opens with the source and the search of the initial filter", () => {
		const queryClient = cachedClient();
		renderPanel(queryClient, false, {
			source: "functions",
			search: "send-email",
		});

		expect(observedKeys(queryClient)).toEqual([
			cloudKeys.logs(PROJECT_ID, {
				source: "functions",
				start: ONE_DAY_BEFORE,
				end: NOW,
				search: "send-email",
			}),
		]);
		expect(
			screen.getByRole("searchbox", { name: "Search the log messages" }),
		).toHaveProperty("value", "send-email");
	});

	it("applies the typed search only on submit, without the outer spaces", () => {
		const queryClient = cachedClient();
		renderPanel(queryClient, false);

		fireEvent.change(
			screen.getByRole("searchbox", { name: "Search the log messages" }),
			{ target: { value: "  timeout  " } },
		);

		expect(observedKeys(queryClient)).toEqual([NEWEST_API_KEY]);

		fireEvent.click(screen.getByRole("button", { name: "Search" }));

		expect(observedKeys(queryClient)).toEqual([
			cloudKeys.logs(PROJECT_ID, {
				source: "api",
				start: ONE_DAY_BEFORE,
				end: NOW,
				search: "timeout",
			}),
		]);
	});

	it("turns off Next 24 hours on the newest window", () => {
		renderPanel(cachedClient(), false);

		expect(
			screen
				.getByRole("button", { name: "Next 24 hours" })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	it("moves the window back by 24 hours, and forward again to the newest", () => {
		const queryClient = cachedClient();
		renderPanel(queryClient, false);

		fireEvent.click(screen.getByRole("button", { name: "Previous 24 hours" }));

		expect(observedKeys(queryClient)).toEqual([
			cloudKeys.logs(PROJECT_ID, {
				source: "api",
				start: TWO_DAYS_BEFORE,
				end: ONE_DAY_BEFORE,
			}),
		]);
		const next = screen.getByRole("button", { name: "Next 24 hours" });
		expect(next.hasAttribute("disabled")).toBe(false);

		fireEvent.click(next);

		expect(observedKeys(queryClient)).toEqual([NEWEST_API_KEY]);
		expect(next.hasAttribute("disabled")).toBe(true);
	});

	it("tells that older lines can hide when the route answers 100 lines", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(
			NEWEST_API_KEY,
			Array.from({ length: CLOUD_LOGS_PAGE_SIZE }, (_, index) =>
				logLine(index, "info"),
			),
		);
		renderPanel(queryClient, true);

		expect(
			screen.getByText(
				"Only the newest 100 lines of this window show. Use the search or the level to see fewer lines.",
			),
		).toBeTruthy();
	});

	it("shows the translated level of a line, and no cap note under 100 lines", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(NEWEST_API_KEY, [logLine(1, "warning")]);
		renderPanel(queryClient, true);

		const lines = screen.getByRole("list");
		expect(within(lines).getByText("Warning")).toBeTruthy();
		expect(within(lines).getByText("GET /rest/v1/orders 1")).toBeTruthy();
		expect(screen.queryByText(/Only the newest/)).toBeNull();
	});
});
