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

function switchState(name: string): string | null {
	return screen.getByRole("switch", { name }).getAttribute("aria-checked");
}

beforeEach(resetMockStore);
afterEach(cleanup);

describe("SignInPanel", () => {
	it("shows the user count and one switch per method with its saved state", async () => {
		renderPanel();
		expect(await screen.findByText("312 users")).toBeTruthy();
		expect(switchState("Phone number (OTP)")).toBe("true");
		expect(switchState("Google")).toBe("false");
	});

	it("turns a method on through the mutation and keeps the other methods", async () => {
		renderPanel();
		const google = await screen.findByRole("switch", { name: "Google" });
		fireEvent.click(google);
		await waitFor(() => expect(switchState("Google")).toBe("true"));
		expect(switchState("Phone number (OTP)")).toBe("true");
		expect(switchState("Email and password")).toBe("false");
	});
});
