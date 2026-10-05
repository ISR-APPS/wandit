// @vitest-environment jsdom

import {
	QueryClient,
	QueryClientProvider,
	type QueryKey,
} from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type {
	CloudAuthUser,
	CloudAuthUsersResponse,
	CloudSignupsResponse,
} from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import { CLOUD_ROWS_PAGE_SIZE } from "../../lib/constants";
import { UsersPanel } from "./users-panel";

const PROJECT_ID = crypto.randomUUID();

/** The users key of the first page, as UsersPanel asks for it. */
const FIRST_PAGE_KEY = cloudKeys.authUsers(PROJECT_ID, {
	page: 1,
	pageSize: CLOUD_ROWS_PAGE_SIZE,
});

/** Two days with 1 and 2 sign-ups: 3 in total. */
const SIGNUPS: CloudSignupsResponse["days"] = [
	{ date: "2026-10-02", count: 1 },
	{ date: "2026-10-03", count: 2 },
];

/** A user who signed up and never signed in. */
const ADA: CloudAuthUser = {
	id: "user-ada",
	email: "ada@example.com",
	phone: null,
	createdAt: "2026-10-03T08:00:00.000Z",
	lastSignInAt: null,
	provider: "email",
};

const GRACE: CloudAuthUser = {
	id: "user-grace",
	email: "grace@example.com",
	phone: "+213555000111",
	createdAt: "2026-10-02T08:00:00.000Z",
	lastSignInAt: "2026-10-02T09:00:00.000Z",
	provider: "google",
};

function usersPage(items: CloudAuthUser[]): CloudAuthUsersResponse {
	return {
		items,
		page: 1,
		pageSize: CLOUD_ROWS_PAGE_SIZE,
		total: items.length,
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

function renderPanel(queryClient: QueryClient) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(UsersPanel, {
			projectId: PROJECT_ID,
			isActive: true,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(
				TooltipProvider,
				null,
				createElement(I18nProvider, providerProps),
			),
		),
	);
}

afterEach(cleanup);

describe("UsersPanel", () => {
	it("lists the users with the count and the sign-up total", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.signups(PROJECT_ID), SIGNUPS);
		queryClient.setQueryData(FIRST_PAGE_KEY, usersPage([ADA, GRACE]));
		renderPanel(queryClient);

		expect(screen.getByText("ada@example.com")).toBeTruthy();
		expect(screen.getByText("grace@example.com")).toBeTruthy();
		// Only Ada has no sign-in, so exactly one cell says "Never".
		expect(screen.getAllByText("Never")).toHaveLength(1);
		expect(screen.getByText("2 users")).toBeTruthy();
		expect(screen.getByText("3 sign-ups")).toBeTruthy();
	});

	it("shows the empty message and no count when the app has no users", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.signups(PROJECT_ID), SIGNUPS);
		queryClient.setQueryData(FIRST_PAGE_KEY, usersPage([]));
		renderPanel(queryClient);

		expect(
			screen.getByText("No user has signed up to your app yet."),
		).toBeTruthy();
		expect(screen.queryByText("0 users")).toBeNull();
	});

	it("moves back to the last page when users leave while a later page is open", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.signups(PROJECT_ID), SIGNUPS);
		// Page 1 counted 51 users. Page 2 counts 50: a user was deleted meanwhile.
		queryClient.setQueryData(FIRST_PAGE_KEY, {
			...usersPage([ADA, GRACE]),
			total: CLOUD_ROWS_PAGE_SIZE + 1,
		});
		queryClient.setQueryData(
			cloudKeys.authUsers(PROJECT_ID, {
				page: 2,
				pageSize: CLOUD_ROWS_PAGE_SIZE,
			}),
			{ items: [], page: 2, pageSize: CLOUD_ROWS_PAGE_SIZE, total: 50 },
		);
		renderPanel(queryClient);

		fireEvent.click(screen.getByRole("button", { name: "Next page" }));

		expect(screen.getByText("ada@example.com")).toBeTruthy();
		expect(
			screen.queryByText("No user has signed up to your app yet."),
		).toBeNull();
	});

	it("shows a retry control when the users do not load", async () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.signups(PROJECT_ID), SIGNUPS);
		await failQuery(queryClient, FIRST_PAGE_KEY);
		renderPanel(queryClient);

		expect(screen.getByText("This section did not load.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
	});
});
