// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMockStore } from "../../api/app-builder.services";
import { MOCK_APP_PROJECTS } from "../../lib/mock-projects";
import { MoreView } from "./more-view";

const IN_CLOUD_TEXT =
	"The database, users, files, and logs of this app are in the Cloud tab.";

/** Renders the Backend panel of the More view for a project with `projectId`. */
function renderBackendPanel(projectId: string) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(MoreView, {
			project: { ...MOCK_APP_PROJECTS[0], id: projectId },
			panel: "backend",
			onSelectPanel: vi.fn(),
			onOpenCloud: vi.fn(),
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(I18nProvider, providerProps),
		),
	);
}

beforeEach(resetMockStore);
afterEach(cleanup);

describe("MoreView backend panel", () => {
	it("sends a real project to the Cloud tab and shows no mock summary", async () => {
		renderBackendPanel(crypto.randomUUID());

		expect(await screen.findByText(IN_CLOUD_TEXT)).toBeTruthy();
		expect(screen.queryByText("members")).toBeNull();
	});

	it("shows the mock summary for a seed project", async () => {
		renderBackendPanel("nadi-fitness");

		expect(await screen.findByText("members")).toBeTruthy();
		expect(screen.queryByText(IN_CLOUD_TEXT)).toBeNull();
	});
});
