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
import { ProjectBar } from "./top-bar";

const PROJECT: AppProject = {
	id: "nadi-fitness",
	name: "Nadi Fitness",
	slug: "nadi",
	description: "Membership app for a gym.",
	kind: "web",
	versionNumber: 4,
	unpublishedChanges: 3,
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
			createElement(ProjectBar, { project: PROJECT, chatOpen, onExpandChat }),
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
