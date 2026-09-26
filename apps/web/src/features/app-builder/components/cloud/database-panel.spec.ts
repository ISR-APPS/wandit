// @vitest-environment jsdom

import {
	QueryClient,
	QueryClientProvider,
	type QueryKey,
} from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type {
	CloudRowsQuery,
	CloudRowsResponse,
	CloudTable,
} from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import { DatabasePanel } from "./database-panel";

const PROJECT_ID = crypto.randomUUID();

const ORDERS: CloudTable = {
	name: "orders",
	columns: [
		{ name: "id", dataType: "integer", isNullable: false, defaultValue: null },
		{
			name: "total",
			dataType: "numeric",
			isNullable: true,
			defaultValue: null,
		},
	],
	rowCount: 1200,
	rowCountExact: false,
};

/** The rows key of one page of `orders`, as TableRows asks for it. */
function pageKey(query: Partial<CloudRowsQuery> = {}): QueryKey {
	return cloudKeys.rows(PROJECT_ID, "orders", {
		page: 1,
		pageSize: 50,
		dir: "asc",
		...query,
	});
}

/** One page answer with two rows and the table count `total`. */
function pageOf(page: number, total: number): CloudRowsResponse {
	return {
		items: [
			{ id: page * 10 + 1, total: 20 },
			{ id: page * 10 + 2, total: null },
		],
		page,
		pageSize: 50,
		total,
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

// Puts a failed first load in the cache, like a 500 from the API.
async function failQuery(
	queryClient: QueryClient,
	queryKey: QueryKey,
): Promise<void> {
	await queryClient.prefetchQuery({
		queryKey,
		queryFn: () => Promise.reject(new Error("The API is down.")),
		retry: false,
	});
}

function renderPanel(queryClient: QueryClient, isActive = true) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(DatabasePanel, { projectId: PROJECT_ID, isActive }),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
}

/** A cache with the table list, where a click on `orders` opens its rows. */
function clientWithOrders(): QueryClient {
	const queryClient = cachedClient();
	queryClient.setQueryData(cloudKeys.tables(PROJECT_ID), [ORDERS]);
	return queryClient;
}

function openOrders(): void {
	fireEvent.click(screen.getByRole("button", { name: "orders" }));
}

afterEach(cleanup);

describe("DatabasePanel", () => {
	it("lists the tables with the estimate and opens the rows of a clicked table", () => {
		const queryClient = clientWithOrders();
		queryClient.setQueryData(pageKey(), pageOf(1, 2));
		renderPanel(queryClient);
		expect(screen.getByText("About 1,200")).toBeTruthy();

		openOrders();

		expect(screen.getByText("2 rows")).toBeTruthy();
		expect(screen.getByText("NULL")).toBeTruthy();
		expect(
			screen
				.getByRole("columnheader", { name: "id" })
				.getAttribute("aria-sort"),
		).toBe("ascending");
	});

	it("tells that a dropped table is gone, and the way back reads the list again", () => {
		const queryClient = clientWithOrders();
		queryClient.setQueryData(pageKey(), null);
		// The resolved mock stops the refetch, so the case makes no API call.
		const invalidate = vi
			.spyOn(queryClient, "invalidateQueries")
			.mockResolvedValue();
		renderPanel(queryClient);
		openOrders();

		expect(
			screen.getByText("This table or one of its columns no longer exists."),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "All tables" }));

		expect(screen.getByText("About 1,200")).toBeTruthy();
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: cloudKeys.tables(PROJECT_ID),
		});
	});

	it("starts a new sort on the first page", () => {
		const queryClient = clientWithOrders();
		queryClient.setQueryData(pageKey(), pageOf(1, 120));
		queryClient.setQueryData(pageKey({ page: 2 }), pageOf(2, 120));
		queryClient.setQueryData(pageKey({ sort: "total" }), pageOf(1, 120));
		renderPanel(queryClient);
		openOrders();

		fireEvent.click(screen.getByRole("button", { name: "Next page" }));
		expect(screen.getByText("Page 2 of 3")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "total" }));

		expect(screen.getByText("Page 1 of 3")).toBeTruthy();
		expect(
			screen
				.getByRole("columnheader", { name: "total" })
				.getAttribute("aria-sort"),
		).toBe("ascending");
	});

	it("moves to the last page when the rows of the open page are gone", () => {
		const queryClient = clientWithOrders();
		queryClient.setQueryData(pageKey(), pageOf(1, 120));
		// A write deleted rows: page 2 answers no items and a smaller count.
		queryClient.setQueryData(pageKey({ page: 2 }), {
			items: [],
			page: 2,
			pageSize: 50,
			total: 40,
		});
		renderPanel(queryClient);
		openOrders();

		fireEvent.click(screen.getByRole("button", { name: "Next page" }));

		expect(screen.getByText("Page 1 of 3")).toBeTruthy();
		expect(screen.queryByText("This table has no rows.")).toBeNull();
	});

	it("goes back to the default sort when a retry follows a failed sort", async () => {
		const queryClient = clientWithOrders();
		queryClient.setQueryData(pageKey(), pageOf(1, 2));
		// Postgres refuses to order some types, for example json.
		await failQuery(queryClient, pageKey({ sort: "total" }));
		const invalidate = vi
			.spyOn(queryClient, "invalidateQueries")
			.mockResolvedValue();
		// A new sort key with no data counts as stale and would fetch. A hidden
		// view reads nothing, so the cached error stays and no API call runs.
		renderPanel(queryClient, false);
		openOrders();

		fireEvent.click(screen.getByRole("button", { name: "total" }));
		expect(screen.getByText("The rows did not load.")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(
			screen
				.getByRole("columnheader", { name: "id" })
				.getAttribute("aria-sort"),
		).toBe("ascending");
		// The retry reads the backend state too, because a 409 can mean it fell asleep.
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: cloudKeys.all(PROJECT_ID),
		});
	});

	it("reads no rows for a table without columns", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.tables(PROJECT_ID), [
			{ ...ORDERS, columns: [] },
		]);
		renderPanel(queryClient);
		openOrders();

		expect(screen.getByText("This table has no columns.")).toBeTruthy();
		expect(queryClient.getQueryState(pageKey())?.fetchStatus).toBe("idle");
	});

	it("shows a retry control when the table list does not load", async () => {
		const queryClient = cachedClient();
		await failQuery(queryClient, cloudKeys.tables(PROJECT_ID));
		renderPanel(queryClient);

		expect(screen.getByText("The tables did not load.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
	});

	it("shows the empty message when the database has no tables", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.tables(PROJECT_ID), []);
		renderPanel(queryClient);

		expect(
			screen.getByText(
				"The database has no tables yet. Ask the agent to add one.",
			),
		).toBeTruthy();
	});

	it("reads nothing while the Cloud view is hidden", () => {
		const queryClient = cachedClient();
		renderPanel(queryClient, false);

		expect(
			queryClient.getQueryState(cloudKeys.tables(PROJECT_ID))?.fetchStatus,
		).toBe("idle");
		expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
	});
});
