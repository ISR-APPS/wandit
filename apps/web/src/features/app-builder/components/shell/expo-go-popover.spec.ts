// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpoGoLinkBody, type ExpoGoLinkBodyProps } from "./expo-go-popover";

const EXPO_URL =
	"exps://m-abcdefghijklmnopqrs27--p-11111111-1111-4111-8111-111111111111.wanditpreview.app";

function renderBody(overrides: Partial<ExpoGoLinkBodyProps> = {}) {
	const props: ExpoGoLinkBodyProps = {
		link: { status: "ready", expoUrl: EXPO_URL, isExpired: false },
		expoUsername: "",
		onSaveUsername: vi.fn(),
		onRefresh: vi.fn(),
		...overrides,
	};
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(ExpoGoLinkBody, props),
	};
	render(createElement(I18nProvider, providerProps));
	return props;
}

afterEach(cleanup);

describe("ExpoGoLinkBody", () => {
	it("shows the QR, the URL, the copy button, the store links, the SDK, and the OAuth note", () => {
		renderBody();

		expect(screen.getByTitle("QR code of the Expo Go link")).toBeTruthy();
		expect(screen.getByText(EXPO_URL)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "App Store" }).getAttribute("href"),
		).toContain("apps.apple.com");
		expect(
			screen.getByRole("link", { name: "Google Play" }).getAttribute("href"),
		).toContain("host.exp.exponent");
		expect(screen.getByText(/Needs Expo Go for SDK 57/)).toBeTruthy();
		expect(
			screen.getByText("Google sign-in does not work in Expo Go."),
		).toBeTruthy();
	});

	it("replaces an expired QR with a new-link button", () => {
		const props = renderBody({
			link: { status: "ready", expoUrl: EXPO_URL, isExpired: true },
		});

		expect(screen.queryByTitle("QR code of the Expo Go link")).toBeNull();
		expect(screen.getByText("This link expired.")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "New link" }));
		expect(props.onRefresh).toHaveBeenCalledOnce();
	});

	it("shows the error text with a retry button", () => {
		const props = renderBody({
			link: { status: "error", message: "Your app is not running yet." },
		});

		expect(screen.getByRole("alert").textContent).toContain(
			"Your app is not running yet.",
		);
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(props.onRefresh).toHaveBeenCalledOnce();
	});

	it("saves a typed username and blocks one the API would reject", () => {
		const props = renderBody();
		const input = screen.getByLabelText("Expo Go username (iPhone)");
		const save = screen.getByRole("button", { name: "Save" });

		fireEvent.change(input, { target: { value: "bad/name" } });
		expect(save.hasAttribute("disabled")).toBe(true);
		expect(
			screen.getByText("Use letters, digits, dots, dashes, or underscores."),
		).toBeTruthy();

		fireEvent.change(input, { target: { value: "zack_dev" } });
		fireEvent.click(save);
		expect(props.onSaveUsername).toHaveBeenCalledWith("zack_dev");
	});

	it("shows a saved username with a change button that opens the field", () => {
		renderBody({ expoUsername: "zack" });

		expect(screen.getByText("iPhone account: zack")).toBeTruthy();
		expect(screen.queryByLabelText("Expo Go username (iPhone)")).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Change Expo Go username" }),
		);
		expect(screen.getByLabelText("Expo Go username (iPhone)")).toBeTruthy();
	});
});
