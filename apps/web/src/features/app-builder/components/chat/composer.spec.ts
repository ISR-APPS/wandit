// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Composer, type ComposerProps } from "./composer";

// The page mounts one TooltipProvider; the icon buttons need it too.
function renderComposer(props: Partial<ComposerProps> = {}) {
	// The API admits every send of these cases.
	const onSend = vi.fn<ComposerProps["onSend"]>(async () => true);
	// I18nProvider requires children in its props type for createElement calls.
	// The dictation hook refreshes the credits, so it needs a query client.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(
				TooltipProvider,
				null,
				createElement(Composer, {
					turnEstimateCredits: 6,
					targets: [],
					onRemoveTarget: vi.fn(),
					isSending: false,
					onSend,
					placeholder: "Ask Wandit…",
					isPlanMode: false,
					onPlanModeChange: vi.fn(),
					...props,
				}),
			),
		),
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
	it("sends the trimmed draft on Enter and clears it", () => {
		const { onSend, textarea } = renderComposer();
		typeAndEnter(textarea, "  Add a login page  ");
		expect(onSend).toHaveBeenCalledWith({
			text: "Add a login page",
			files: [],
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

	it("locks the textarea and the send button while a turn runs", () => {
		const { textarea } = renderComposer({ isSending: true });
		expect(textarea.hasAttribute("disabled")).toBe(true);
		expect(
			screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"),
		).toBe(true);
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
