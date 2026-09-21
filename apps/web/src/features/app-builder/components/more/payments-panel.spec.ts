// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appBuilderKeys } from "../../api/app-builder.queries";
import { resetMockStore } from "../../api/app-builder.services";
import type { PaymentsSummary } from "../../api/dto";
import { PaymentsPanel } from "./payments-panel";

const PROJECT_ID = "nadi-fitness";
const BADGE = { selector: '[data-slot="badge"]' };

function renderPanel(client = new QueryClient()) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			Suspense,
			{ fallback: null },
			createElement(PaymentsPanel, { projectId: PROJECT_ID }),
		),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(I18nProvider, providerProps),
		),
	);
}

beforeEach(resetMockStore);
afterEach(cleanup);

describe("PaymentsPanel", () => {
	it("lists the products and marks the live provider", async () => {
		renderPanel();
		expect(await screen.findByText("Monthly pass")).toBeTruthy();
		expect(screen.getByText("recurring · 30 days")).toBeTruthy();
		expect(screen.getByText("one-time")).toBeTruthy();
		expect(screen.getByText("Live", BADGE)).toBeTruthy();
		expect(screen.getByText("Receiving events")).toBeTruthy();
	});

	it("drops the live badge after a switch to test keys", async () => {
		renderPanel();
		await screen.findByText("Monthly pass");
		fireEvent.click(screen.getByRole("button", { name: "Test" }));
		await waitFor(() => {
			expect(screen.queryByText("Live", BADGE)).toBeNull();
		});
	});

	it("offers to connect a provider when none is connected", () => {
		// Cached data with an infinite stale time renders at once and never refetches.
		const client = new QueryClient({
			defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
		});
		const summary: PaymentsSummary = {
			provider: null,
			products: [],
			collectedDzd: 0,
			collectedMonth: "2026-09",
			paymentCount: 0,
			refundCount: 0,
			webhookPath: "/api/payments/webhook",
			webhookReceiving: false,
		};
		client.setQueryData(appBuilderKeys.payments(PROJECT_ID), summary);
		renderPanel(client);
		expect(screen.getByText("No payment provider yet")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Connect Chargily Pay" }),
		).toBeTruthy();
		expect(screen.queryByText("Products")).toBeNull();
	});
});
