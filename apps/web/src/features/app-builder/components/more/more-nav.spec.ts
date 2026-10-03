// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoreNav, type MoreNavProps } from "./more-nav";

function renderNav(props: Partial<MoreNavProps> = {}) {
	const onSelect = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(MoreNav, {
			kind: "web",
			active: "analytics",
			showBackendGroup: true,
			onSelect,
			...props,
		}),
	};
	render(createElement(I18nProvider, providerProps));
	return { onSelect };
}

afterEach(cleanup);

describe("MoreNav", () => {
	it("lists Domains and not App stores for a web app", () => {
		renderNav({ kind: "web" });
		expect(screen.getByRole("button", { name: "Domains" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "App stores" })).toBeNull();
	});

	it("lists App stores and not Domains for a mobile app", () => {
		renderNav({ kind: "mobile" });
		expect(screen.getByRole("button", { name: "App stores" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Domains" })).toBeNull();
	});

	it("calls onSelect with the panel of the clicked item", () => {
		const { onSelect } = renderNav();
		fireEvent.click(screen.getByRole("button", { name: "Payments" }));
		expect(onSelect).toHaveBeenCalledWith("payments");
	});

	it("marks only the active item with aria-current", () => {
		renderNav({ active: "logs" });
		expect(
			screen.getByRole("button", { name: "Logs" }).getAttribute("aria-current"),
		).toBe("page");
		expect(
			screen
				.getByRole("button", { name: "Analytics" })
				.getAttribute("aria-current"),
		).toBeNull();
	});

	it("puts the Backend group with the seven Cloud panels right after Analytics", () => {
		const { onSelect } = renderNav();
		const group = screen.getByRole("group", { name: "Backend" });
		const cloudItems = [...group.querySelectorAll("button")];
		expect(cloudItems.map((item) => item.textContent)).toEqual([
			"Database",
			"Users",
			"Storage",
			"Secrets",
			"Logs",
			"Functions",
			"Jobs",
		]);
		const labels = [...screen.getAllByRole("button")].map(
			(item) => item.textContent,
		);
		expect(labels.slice(0, 3)).toEqual(["Analytics", "Database", "Users"]);

		fireEvent.click(screen.getByRole("button", { name: "Storage" }));
		expect(onSelect).toHaveBeenCalledWith("storage");
	});

	it("hides the Backend group while the Cloud gate is closed", () => {
		renderNav({ showBackendGroup: false });
		expect(screen.queryByRole("group", { name: "Backend" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Database" })).toBeNull();
		expect(screen.getByRole("button", { name: "Sign-in" })).toBeTruthy();
	});

	it("shows Integrations as a disabled Soon item that selects nothing", () => {
		const { onSelect } = renderNav();
		const integrations = screen.getByRole("button", { name: /^Integrations/ });
		expect(within(integrations).getByText("Soon")).toBeTruthy();
		expect(integrations).toHaveProperty("disabled", true);
		fireEvent.click(integrations);
		expect(onSelect).not.toHaveBeenCalled();
	});
});
