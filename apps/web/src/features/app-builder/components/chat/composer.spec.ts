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

	it("renders the top slot above the textarea and reports each draft change", () => {
		const onDraftChange = vi.fn();
		const { textarea } = renderComposer({
			topSlot: createElement("p", null, "Which style?"),
			onDraftChange,
		});
		expect(screen.getByText("Which style?")).toBeTruthy();
		fireEvent.change(textarea, { target: { value: "Green" } });
		expect(onDraftChange).toHaveBeenLastCalledWith("Green");
	});

	it("answers the tray with an empty draft when the override allows it", () => {
		const onSubmit = vi.fn();
		const { onSend } = renderComposer({
			submitOverride: {
				label: "Choose this option",
				disabled: false,
				onSubmit,
			},
		});
		expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Choose this option" }));
		expect(onSubmit).toHaveBeenCalledWith("");
		expect(onSend).not.toHaveBeenCalled();
	});

	it("sends the typed draft to the override on Enter and clears it", () => {
		const onSubmit = vi.fn();
		const { textarea } = renderComposer({
			submitOverride: { label: "Answer", disabled: false, onSubmit },
		});
		typeAndEnter(textarea, "  Use green  ");
		expect(onSubmit).toHaveBeenCalledWith("Use green");
		expect(textarea.value).toBe("");
	});

	it("locks the answer button while the override is incomplete", () => {
		const onSubmit = vi.fn();
		const { textarea } = renderComposer({
			submitOverride: { label: "Choose an option", disabled: true, onSubmit },
		});
		typeAndEnter(textarea, "text");
		expect(onSubmit).not.toHaveBeenCalled();
		expect(
			screen
				.getByRole("button", { name: "Choose an option" })
				.hasAttribute("disabled"),
		).toBe(true);
	});
});
