// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
		renderNav({ active: "backend" });
		expect(
			screen
				.getByRole("button", { name: "Backend" })
				.getAttribute("aria-current"),
		).toBe("page");
		expect(
			screen
				.getByRole("button", { name: "Analytics" })
				.getAttribute("aria-current"),
		).toBeNull();
	});
});
