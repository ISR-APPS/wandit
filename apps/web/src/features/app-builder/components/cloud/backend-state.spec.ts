// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { CloudBackendResponse } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import { BackendState } from "./backend-state";

const PROJECT_ID = crypto.randomUUID();

function backend(
	status: CloudBackendResponse["status"],
	failureCode: string | null = null,
): CloudBackendResponse {
	return {
		status,
		ref: "abcdefghijklmnopqrst",
		region: "eu-west-3",
		failureCode,
	};
}

// Nothing is stale or retried, so the gate never calls the API.
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

/** A cache that holds the backend `state`. */
function clientWith(state: CloudBackendResponse): QueryClient {
	const queryClient = cachedClient();
	queryClient.setQueryData(cloudKeys.backend(PROJECT_ID), state);
	return queryClient;
}

function renderGate(queryClient: QueryClient) {
	// BackendState and I18nProvider require children in their props types for createElement calls.
	const gateProps: ComponentProps<typeof BackendState> = {
		projectId: PROJECT_ID,
		isActive: true,
		children: createElement("p", null, "The database panel"),
	};
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(BackendState, gateProps),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
}

afterEach(cleanup);

describe("BackendState", () => {
	it("shows the wrapped panel only while the backend is active", () => {
		renderGate(clientWith(backend("active")));
		expect(screen.getByText("The database panel")).toBeTruthy();

		cleanup();
		renderGate(clientWith(backend("paused")));
		expect(screen.queryByText("The database panel")).toBeNull();
		expect(screen.getByRole("button", { name: "Wake up" })).toBeTruthy();
	});

	it("shows a retry control when the first read fails", async () => {
		const queryClient = cachedClient();
		await queryClient.prefetchQuery({
			queryKey: cloudKeys.backend(PROJECT_ID),
			queryFn: () => Promise.reject(new Error("The API is down.")),
			retry: false,
		});
		renderGate(queryClient);

		expect(screen.getByText("The backend state did not load.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
		expect(screen.queryByText("The database panel")).toBeNull();
	});

	it("offers to enable a missing backend", () => {
		renderGate(clientWith(backend("none")));
		expect(screen.getByRole("button", { name: "Enable backend" })).toBeTruthy();
	});

	it("shows the same wait text while the backend is created or woken", () => {
		for (const status of ["creating", "restoring"] as const) {
			renderGate(clientWith(backend(status)));
			expect(
				screen.getByText(
					"Setting up your backend. This takes about 2 minutes.",
				),
			).toBeTruthy();
			cleanup();
		}
	});

	it("tells that the backend is being deleted", () => {
		renderGate(clientWith(backend("deleting")));
		expect(
			screen.getByText("The backend of this project is being deleted."),
		).toBeTruthy();
	});

	it("shows the text of a known failure code, the code, and a check-again button", () => {
		renderGate(clientWith(backend("error", "backend_provision_timeout")));
		expect(
			screen.getByText("The backend setup took too long and stopped."),
		).toBeTruthy();
		expect(
			screen.getByText("Error code: backend_provision_timeout"),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
	});

	it("shows the generic text for an unknown failure code", () => {
		renderGate(clientWith(backend("error", "provider_quota")));
		expect(
			screen.getByText("An unexpected error stopped the backend setup."),
		).toBeTruthy();
	});
});
