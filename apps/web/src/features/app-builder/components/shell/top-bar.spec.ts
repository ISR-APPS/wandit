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
import { PreviewActions, ProjectBar } from "./top-bar";

const PROJECT: AppProject = {
	id: "nadi-fitness",
	name: "Nadi Fitness",
	slug: "nadi",
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
function renderActions(kind: AppProject["kind"]) {
	const onOpenExternal = vi.fn();
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
				onOpenExternal,
			}),
		),
	};
	render(createElement(I18nProvider, providerProps));
	return { onOpenExternal };
}

describe("PreviewActions", () => {
	it("gives a web app the new-tab button and no Expo Go button", () => {
		const { onOpenExternal } = renderActions("web");
		fireEvent.click(screen.getByRole("button", { name: "Open in a new tab" }));
		expect(onOpenExternal).toHaveBeenCalledOnce();
		expect(screen.queryByRole("button", { name: "Open on phone" })).toBeNull();
	});

	it("gives a mobile app the Expo Go button and no new-tab button: it has no site", () => {
		renderActions("mobile");
		expect(screen.getByRole("button", { name: "Open on phone" })).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Open in a new tab" }),
		).toBeNull();
		expect(
			screen.getByRole("button", { name: "Reload the preview" }),
		).toBeTruthy();
	});
});
