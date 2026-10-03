// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { PaymentsPanel } from "./payments-panel";

function renderPanel() {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(PaymentsPanel),
	};
	return render(createElement(I18nProvider, providerProps));
}

afterEach(cleanup);

describe("PaymentsPanel", () => {
	it("shows the coming-soon page with its three planned features", () => {
		renderPanel();
		expect(screen.getByText("Soon")).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Payments are coming soon" }),
		).toBeTruthy();
		expect(
			screen.getByText(
				"Soon you can accept payments in your web apps and SaaS, set up from the chat.",
			),
		).toBeTruthy();
		expect(
			screen.getAllByRole("listitem").map((item) => item.textContent),
		).toEqual([
			"One-time payments",
			"Subscriptions",
			"Test mode before you go live",
		]);
	});

	it("has no button and names no payment provider", () => {
		const { container } = renderPanel();
		expect(screen.queryByRole("button")).toBeNull();
		expect(container.textContent).not.toMatch(
			/chargily|cib|edahabia|stripe|paddle/i,
		);
	});
});
