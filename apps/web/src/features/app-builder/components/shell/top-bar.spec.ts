// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The router is a third-party module. The stub lets the bar render outside a RouterProvider.
vi.mock("@tanstack/react-router", () => ({
	Link: (props: {
		to: string;
		className?: string;
		"aria-label"?: string;
		children?: ReactNode;
	}) =>
		createElement(
			"a",
			{
				href: props.to,
				className: props.className,
				"aria-label": props["aria-label"],
			},
			props.children,
		),
	useNavigate: () => vi.fn(),
}));

import type { AppProject } from "../../api/dto";
import { PreviewActions, ProjectBar, ViewSwitcher } from "./top-bar";

const PROJECT: AppProject = {
	id: "nadi-fitness",
	name: "Nadi Fitness",
	description: "Membership app for a gym.",
	kind: "web",
	engine: "v2_app",
	versionNumber: 4,
	unpublishedChanges: 3,
	hasCodeChanges: true,
};

// The bar shows tooltips and translated labels; the page mounts both providers.
function renderBar(chatOpen: boolean) {
	const onExpandChat = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			TooltipProvider,
			null,
			createElement(ProjectBar, {
				project: PROJECT,
				chatOpen,
				onExpandChat,
				liveCommitSha: null,
				onRestored: vi.fn(),
			}),
		),
	};
	render(createElement(I18nProvider, providerProps));
	return { onExpandChat };
}

afterEach(cleanup);

describe("ProjectBar", () => {
	it("shows the project name and hides the expand button while the chat is open", () => {
		renderBar(true);
		expect(screen.getByText("Nadi Fitness")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Show the chat" })).toBeNull();
	});

	it("opens the chat from the expand button while the chat is closed", () => {
		const { onExpandChat } = renderBar(false);
		fireEvent.click(screen.getByRole("button", { name: "Show the chat" }));
		expect(onExpandChat).toHaveBeenCalledOnce();
	});
});

// Renders the preview controls of one project kind inside the two providers of the page.
function renderActions(kind: AppProject["kind"], liveUrl: string | null) {
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			TooltipProvider,
			null,
			createElement(PreviewActions, {
				project: { ...PROJECT, kind },
				device: "ios",
				viewport: "desktop",
				onChangeDevice: vi.fn(),
				onChangeViewport: vi.fn(),
				onReload: vi.fn(),
				liveUrl,
			}),
		),
	};
	render(createElement(I18nProvider, providerProps));
}

describe("PreviewActions", () => {
	it("gives a published web app the live app link and no Expo Go button", () => {
		renderActions("web", "https://nadi.wandit.app");
		expect(
			screen
				.getByRole("link", { name: "Open the live app" })
				.getAttribute("href"),
		).toBe("https://nadi.wandit.app");
		expect(screen.queryByRole("button", { name: "Open on phone" })).toBeNull();
	});

	it("gives a mobile app the Expo Go button and no live app link: it has no site", () => {
		renderActions("mobile", null);
		expect(screen.getByRole("button", { name: "Open on phone" })).toBeTruthy();
		expect(
			screen.queryByRole("link", { name: "Open the live app" }),
		).toBeNull();
		expect(
			screen.getByRole("button", { name: "Reload the preview" }),
		).toBeTruthy();
	});
});

describe("ViewSwitcher", () => {
	it("lists Preview, Code, and More, and no Cloud view", () => {
		const onChangeView = vi.fn();
		const providerProps: ComponentProps<typeof I18nProvider> = {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(ViewSwitcher, { view: "preview", onChangeView }),
		};
		render(createElement(I18nProvider, providerProps));

		const views = screen.getByRole("group", { name: "Workspace views" });
		expect(
			[...views.querySelectorAll("button")].map(
				(button) => button.getAttribute("aria-label") ?? button.textContent,
			),
		).toEqual(["Preview", "Code", "More"]);
		expect(screen.queryByRole("button", { name: "Cloud" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "More" }));
		expect(onChangeView).toHaveBeenCalledWith("more");
	});
});
