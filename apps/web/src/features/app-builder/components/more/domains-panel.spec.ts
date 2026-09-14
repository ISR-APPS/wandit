// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appBuilderKeys } from "../../api/app-builder.queries";
import { resetMockStore } from "../../api/app-builder.services";
import type { ProjectDomain } from "../../api/dto";
import { DomainsPanel } from "./domains-panel";

const PROJECT_ID = "nadi-fitness";

function renderPanel(client = new QueryClient()) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			Suspense,
			{ fallback: null },
			createElement(DomainsPanel, { projectId: PROJECT_ID }),
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

describe("DomainsPanel", () => {
	it("marks the free domain live and the custom domain verifying", async () => {
		renderPanel();
		const free = (await screen.findByText("nadi.wandit.app")).closest("li");
		expect(free).not.toBeNull();
		expect(free?.textContent).toContain("Free Wandit domain · primary");
		expect(free?.textContent).toContain("Live");

		const custom = screen.getByText("nadifitness.dz").closest("li");
		expect(custom).not.toBeNull();
		expect(custom?.textContent).toContain(
			"Waiting for DNS · point CNAME to proxy.wandit.app",
		);
		expect(custom?.textContent).toContain("Verifying");
	});

	it("shows no note under a live custom domain", () => {
		// Cached data with an infinite stale time renders at once and never refetches.
		const client = new QueryClient({
			defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
		});
		const domains: ProjectDomain[] = [
			{ host: "gym.dz", kind: "custom", status: "live", cnameTarget: null },
		];
		client.setQueryData(appBuilderKeys.domains(PROJECT_ID), domains);
		renderPanel(client);
		const row = screen.getByText("gym.dz").closest("li");
		expect(row?.textContent).toBe("gym.dzLive");
	});

	it("enables Connect only once a domain is typed", async () => {
		renderPanel();
		await screen.findByText("nadi.wandit.app");
		const connect = screen.getByRole("button", { name: "Connect" });
		const input = screen.getByRole("textbox", { name: "Domain to connect" });
		expect(connect.hasAttribute("disabled")).toBe(true);

		fireEvent.change(input, { target: { value: "   " } });
		expect(connect.hasAttribute("disabled")).toBe(true);

		fireEvent.change(input, { target: { value: "gym.dz" } });
		expect(connect.hasAttribute("disabled")).toBe(false);
	});
});
