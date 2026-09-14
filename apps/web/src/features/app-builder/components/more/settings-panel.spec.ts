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
import { getAppProject, resetMockStore } from "../../api/app-builder.services";
import type { AppProject, ProjectSettings } from "../../api/dto";
import { SettingsPanel } from "./settings-panel";

const project: AppProject = {
	id: "nadi-fitness",
	name: "Nadi Fitness",
	slug: "nadi",
	description: "Membership app for a gym in Oran.",
	kind: "web",
	versionNumber: 4,
	unpublishedChanges: 3,
};

function renderPanel(client = new QueryClient()) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			Suspense,
			{ fallback: null },
			createElement(SettingsPanel, { project }),
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

describe("SettingsPanel", () => {
	it("switches the project kind through the mutation", async () => {
		renderPanel();
		await screen.findByText("Collaborators");
		fireEvent.click(screen.getByRole("button", { name: "Mobile app" }));
		await waitFor(async () => {
			expect((await getAppProject(project.id))?.kind).toBe("mobile");
		});
	});

	it("saves a trimmed name on blur and ignores an unchanged one", async () => {
		renderPanel();
		const input = await screen.findByRole("textbox", { name: "Name" });
		fireEvent.change(input, { target: { value: "  Nadi Gym " } });
		fireEvent.blur(input);
		await waitFor(async () => {
			expect((await getAppProject(project.id))?.name).toBe("Nadi Gym");
		});

		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.blur(input);
		// An empty draft never reaches the store.
		expect((await getAppProject(project.id))?.name).toBe("Nadi Gym");
	});

	it("saves a changed description on blur", async () => {
		renderPanel();
		const textarea = await screen.findByRole("textbox", {
			name: "Description",
		});
		fireEvent.change(textarea, { target: { value: "Gym app for Oran." } });
		fireEvent.blur(textarea);
		await waitFor(async () => {
			expect((await getAppProject(project.id))?.description).toBe(
				"Gym app for Oran.",
			);
		});
	});

	it("shows the owner as text and gives the other seats a role menu", async () => {
		renderPanel();
		const owner = (await screen.findByText("Zaki Benali")).closest(".border-t");
		expect(owner).not.toBeNull();
		expect(owner?.textContent).toContain("Owner");
		expect(owner?.querySelector('[role="combobox"]')).toBeNull();
		expect(screen.getAllByRole("combobox")).toHaveLength(2);
		expect(
			screen.getByRole("combobox", { name: "Role of Lina Cherif" }),
		).toBeTruthy();
		expect(screen.getByText("Invited · pending")).toBeTruthy();
	});

	it("masks secrets and names the panel that set each variable", async () => {
		renderPanel();
		await screen.findByText("CHARGILY_SECRET_KEY");
		expect(screen.getAllByText("••••••••••••")).toHaveLength(2);
		expect(screen.getByText("https://nadi.wandit.app")).toBeTruthy();
		expect(screen.getByText("Set by Payments")).toBeTruthy();
		expect(screen.getByText("Set by Sign-in")).toBeTruthy();
		expect(screen.getByText("Public")).toBeTruthy();
	});

	it("shows no origin for a private variable the user added", () => {
		// Cached data with an infinite stale time renders at once and never refetches.
		const client = new QueryClient({
			defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
		});
		const settings: ProjectSettings = {
			collaborators: [],
			collaboratorLimit: 5,
			environmentVariables: [
				{ name: "INTERNAL_FLAG", value: "1", setBy: null, isPublic: false },
			],
		};
		client.setQueryData(appBuilderKeys.settings(project.id), settings);
		renderPanel(client);
		const row = screen.getByText("INTERNAL_FLAG").closest(".border-t");
		expect(row?.textContent).toBe("INTERNAL_FLAG1");
	});

	it("asks for confirmation before a delete", async () => {
		renderPanel();
		await screen.findByText("Collaborators");
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		expect(screen.getByRole("alertdialog")).toBeTruthy();
		expect(screen.getByText("Delete Nadi Fitness?")).toBeTruthy();
	});
});
