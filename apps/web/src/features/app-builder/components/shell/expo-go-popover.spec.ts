// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
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
	// The page mounts one TooltipProvider; the copy button needs it too.
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			TooltipProvider,
			null,
			createElement(ExpoGoLinkBody, props),
		),
	};
	render(createElement(I18nProvider, providerProps));
	return props;
}

afterEach(cleanup);

describe("ExpoGoLinkBody", () => {
	it("shows the QR of a ready link with its URL and copy button", () => {
		renderBody();

		expect(screen.getByTitle("QR code of the Expo Go link")).toBeTruthy();
		expect(screen.getByText(EXPO_URL)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
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

	it("opens the username field from its link, saves a typed name, and blocks one the API would reject", () => {
		const props = renderBody();
		// Android needs no username, so the field stays closed until the user asks for it.
		expect(screen.queryByLabelText("Expo Go username (iPhone)")).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "iPhone? Add your Expo Go username" }),
		);
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
});
