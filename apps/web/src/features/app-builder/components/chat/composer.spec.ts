// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Composer, type ComposerProps } from "./composer";

function renderComposer(props: Partial<ComposerProps> = {}) {
	const onSend = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(Composer, {
			turnEstimateCredits: 6,
			focusLabel: "Pass screen",
			isSending: false,
			onSend,
			...props,
		}),
	};
	render(createElement(I18nProvider, providerProps));
	return { onSend, textarea: screen.getByRole<HTMLTextAreaElement>("textbox") };
}

function typeAndEnter(textarea: HTMLTextAreaElement, value: string) {
	fireEvent.change(textarea, { target: { value } });
	fireEvent.keyDown(textarea, { key: "Enter" });
}

afterEach(cleanup);

describe("Composer", () => {
	it("sends the trimmed draft in build mode on Enter and clears it", () => {
		const { onSend, textarea } = renderComposer();
		typeAndEnter(textarea, "  Add a login page  ");
		expect(onSend).toHaveBeenCalledWith({
			text: "Add a login page",
			mode: "build",
		});
		expect(textarea.value).toBe("");
	});

	it("never sends a whitespace-only draft", () => {
		const { onSend, textarea } = renderComposer();
		typeAndEnter(textarea, "   ");
		expect(onSend).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"),
		).toBe(true);
	});

	it("keeps the draft on Shift+Enter and on an IME Enter", () => {
		const { onSend, textarea } = renderComposer();
		fireEvent.change(textarea, { target: { value: "First line" } });
		fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
		fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
		expect(onSend).not.toHaveBeenCalled();
	});

	it("sends in plan mode after Plan is picked in the menu", () => {
		const { onSend, textarea } = renderComposer();
		fireEvent.keyDown(screen.getByRole("button", { name: "Composer mode" }), {
			key: "Enter",
		});
		fireEvent.click(screen.getByRole("menuitem", { name: "Plan" }));
		expect(
			screen.getByRole("button", { name: "Composer mode" }).textContent,
		).toBe("Plan");
		typeAndEnter(textarea, "Explain the QR pass");
		expect(onSend).toHaveBeenCalledWith({
			text: "Explain the QR pass",
			mode: "plan",
		});
	});

	it("locks the textarea and the send button while a turn runs", () => {
		const { textarea } = renderComposer({ isSending: true });
		expect(textarea.hasAttribute("disabled")).toBe(true);
		expect(
			screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"),
		).toBe(true);
	});

	it("opens the add context menu with three items", () => {
		renderComposer();
		fireEvent.keyDown(screen.getByRole("button", { name: "Add context" }), {
			key: "Enter",
		});
		expect(
			screen.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Attach a file", "Add an image", "Reference a screen"]);
	});

	it("shows the focus chip and removes it on the X button", () => {
		renderComposer();
		expect(screen.getByText("Working on Pass screen")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Remove" }));
		expect(screen.queryByText("Working on Pass screen")).toBeNull();
	});
});
