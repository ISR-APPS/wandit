// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ThoughtRow, type ThoughtRowProps } from "./thought-row";

/** The row inside the i18n provider, as the chat renders it. */
function thoughtElement(props: ThoughtRowProps) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(ThoughtRow, props),
	};
	return createElement(I18nProvider, providerProps);
}

function renderThought(props: ThoughtRowProps) {
	return render(thoughtElement(props));
}

afterEach(cleanup);

describe("ThoughtRow", () => {
	it("shows Thinking with the text open while the block streams", () => {
		renderThought({ text: "Plan the page.", seconds: null, isStreaming: true });
		const toggle = screen.getByRole("button", { name: /Thinking/ });
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("Plan the page.")).toBeTruthy();
	});

	it("shows the seconds closed once done, and opens the text on a click", () => {
		renderThought({ text: "Plan the page.", seconds: 5, isStreaming: false });
		const toggle = screen.getByRole("button", { name: "Thought for 5s" });
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("Plan the page.")).toBeNull();
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("Plan the page.")).toBeTruthy();
	});

	it("keeps the user's choice when the block ends", () => {
		const view = renderThought({
			text: "Plan.",
			seconds: null,
			isStreaming: true,
		});
		fireEvent.click(screen.getByRole("button", { name: /Thinking/ }));
		view.rerender(
			thoughtElement({ text: "Plan.", seconds: 3, isStreaming: false }),
		);
		expect(
			screen
				.getByRole("button", { name: "Thought for 3s" })
				.getAttribute("aria-expanded"),
		).toBe("false");
	});

	it("says Thought without seconds for a row stored before the timing, and has no text to open", () => {
		renderThought({ text: "", seconds: null, isStreaming: false });
		const toggle = screen.getByRole("button", { name: "Thought" });
		expect(toggle.hasAttribute("disabled")).toBe(true);
	});
});
