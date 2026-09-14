// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BuilderMessage } from "../../api/dto";
import { ChatPane, type ChatPaneProps } from "./chat-pane";

const MESSAGES: BuilderMessage[] = [
	{ id: "u1", role: "user", parts: [{ type: "text", text: "Build the app" }] },
	{
		id: "a1",
		role: "assistant",
		parts: [{ type: "text", text: "Here is the plan." }],
	},
];

// The page mounts one TooltipProvider; the pane's message actions need it too.
function renderPane(props: Partial<ChatPaneProps> = {}) {
	const onSend = vi.fn();
	const onCollapse = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			TooltipProvider,
			null,
			createElement(ChatPane, {
				messages: MESSAGES,
				turnEstimateCredits: 6,
				focusLabel: null,
				isSending: false,
				projectName: "Nadi Fitness",
				onSend,
				onCollapse,
				onPreviewVersion: () => {},
				...props,
			}),
		),
	};
	render(createElement(I18nProvider, providerProps));
	return { onSend, onCollapse };
}

afterEach(cleanup);

describe("ChatPane", () => {
	it("renders every message and passes a sent draft through", () => {
		const { onSend } = renderPane();
		expect(screen.getByText("Build the app")).toBeTruthy();
		expect(screen.getByText("Here is the plan.")).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Add a QR pass" } });
		fireEvent.keyDown(textarea, { key: "Enter" });
		expect(onSend).toHaveBeenCalledWith({
			text: "Add a QR pass",
			mode: "build",
		});
	});

	it("sends a follow-up as a build turn, and drops it while a turn runs", () => {
		const followUp: BuilderMessage = {
			id: "a2",
			role: "assistant",
			metadata: { followUps: ["Add a classes schedule"] },
			parts: [{ type: "text", text: "Done." }],
		};
		const idle = renderPane({ messages: [followUp] });
		fireEvent.click(
			screen.getByRole("button", { name: "Add a classes schedule" }),
		);
		expect(idle.onSend).toHaveBeenCalledWith({
			text: "Add a classes schedule",
			mode: "build",
		});
		cleanup();
		const busy = renderPane({ messages: [followUp], isSending: true });
		fireEvent.click(
			screen.getByRole("button", { name: "Add a classes schedule" }),
		);
		expect(busy.onSend).not.toHaveBeenCalled();
	});

	it("shows the project name in the header and hides the chat from its button", () => {
		const { onCollapse } = renderPane();
		expect(screen.getByText(/Nadi Fitness/)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Hide the chat" }));
		expect(onCollapse).toHaveBeenCalledOnce();
	});

	it("shows the working row with the elapsed seconds while a turn runs", () => {
		vi.useFakeTimers();
		try {
			renderPane({ isSending: true });
			expect(screen.getByRole("status").textContent).toBe(
				"Wandit is working…0.0s",
			);
			act(() => vi.advanceTimersByTime(1500));
			expect(screen.getByRole("status").textContent).toBe(
				"Wandit is working…1.5s",
			);
		} finally {
			vi.useRealTimers();
		}
	});
});
