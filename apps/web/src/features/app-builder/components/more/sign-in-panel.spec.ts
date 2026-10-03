// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetMockStore } from "../../api/app-builder.services";
import { SignInPanel } from "./sign-in-panel";

function renderPanel() {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			Suspense,
			{ fallback: null },
			createElement(SignInPanel, { projectId: "nadi-fitness" }),
		),
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

describe("SignInPanel", () => {
	it("shows the user count and email and password on and locked", async () => {
		renderPanel();
		expect(await screen.findByText("312 users")).toBeTruthy();
		const emailPassword = screen.getByRole("switch", {
			name: "Email and password",
		});
		expect(emailPassword.getAttribute("aria-checked")).toBe("true");
		expect(emailPassword).toHaveProperty("disabled", true);
		fireEvent.click(emailPassword);
		expect(emailPassword.getAttribute("aria-checked")).toBe("true");
	});

	it("shows the other three methods with a Soon badge and nothing to click", async () => {
		renderPanel();
		await screen.findByText("312 users");
		for (const title of ["Google", "Phone number (OTP)", "Magic link"]) {
			expect(screen.getByText(title)).toBeTruthy();
		}
		expect(screen.getAllByText("Soon")).toHaveLength(3);
		expect(screen.getAllByRole("switch")).toHaveLength(1);
		expect(screen.queryByRole("button")).toBeNull();
		expect(
			screen.getByText(
				"New users sign up with an email and a password. They get no confirmation email.",
			),
		).toBeTruthy();
	});
});
