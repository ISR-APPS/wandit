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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

/** An open single-choice question in the last reply: the tray shows it. */
const QUESTION_MESSAGE: BuilderMessage = {
	id: "a5",
	role: "assistant",
	parts: [
		{
			type: "data-question",
			id: "call-1:question-0",
			data: {
				toolCallId: "call-1",
				questionId: "question-0",
				question: "Which style fits your shop?",
				kind: "single-choice",
				helper: null,
				maxFiles: null,
				options: [
					{ id: "warm", label: "Warm and crafted" },
					{ id: "bold", label: "Bold and loud" },
				],
				isOpen: true,
				isAnswered: false,
			},
		},
	],
};

/** Callbacks of the live ResizeObservers; a case calls them as a browser does on a resize. */
let resizeCallbacks: (() => void)[] = [];

// jsdom has no ResizeObserver; the list follow and the tray motion use one.
class ResizeObserverStub implements ResizeObserver {
	constructor(callback: ResizeObserverCallback) {
		resizeCallbacks.push(() => callback([], this));
	}
	disconnect() {}
	observe() {}
	takeRecords(): ResizeObserverEntry[] {
		return [];
	}
	unobserve() {}
}

// The page mounts one TooltipProvider; the pane's message actions need it too.
function renderPane(props: Partial<ChatPaneProps> = {}) {
	const onSend = vi.fn();
	const onDecideApproval = vi.fn();
	const onAnswerQuestions = vi.fn();
	const paneWith = (overrides: Partial<ChatPaneProps>) => {
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
					targets: [],
					onRemoveTarget: vi.fn(),
					isSending: false,
					phase: null,
					isFirstTurn: false,
					// True keeps the thought rows and the seconds counter of the debug view.
					showsAgentDebug: true,
					isReady: true,
					projectName: "Nadi Fitness",
					onSend,
					onDecideApproval,
					onAnswerQuestions,
					onCancel: () => {},
					errorText: null,
					onCollapse: () => {},
					onPreviewVersion: () => {},
					...props,
					...overrides,
				}),
			),
		};
		return createElement(I18nProvider, providerProps);
	};
	const view = render(paneWith({}));
	return {
		onSend,
		onDecideApproval,
		onAnswerQuestions,
		rerenderWith: (overrides: Partial<ChatPaneProps>) =>
			view.rerender(paneWith(overrides)),
	};
}

/** Gives the list fixed sizes; jsdom has no layout. */
function setListSize(list: HTMLElement, scrollHeight: number) {
	Object.defineProperty(list, "scrollHeight", {
		configurable: true,
		value: scrollHeight,
	});
	Object.defineProperty(list, "clientHeight", {
		configurable: true,
		value: 400,
	});
}

beforeEach(() => {
	resizeCallbacks = [];
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("ChatPane", () => {
	// One active turn per project: the cards stay clickable, so the pane drops a second send.
	it.each<{
		name: string;
		message: BuilderMessage;
		buttonName: string;
		callback: "onSend" | "onDecideApproval";
	}>([
		{
			name: "a follow-up",
			message: {
				id: "a2",
				role: "assistant",
				metadata: { followUps: ["Add a classes schedule"] },
				parts: [{ type: "text", text: "Done." }],
			},
			buttonName: "Add a classes schedule",
			callback: "onSend",
		},
		{
			name: "an approval decision",
			message: {
				id: "a3",
				role: "assistant",
				parts: [
					{
						type: "data-approval",
						id: "ap-1",
						data: {
							approvalId: "ap-1",
							toolName: "run_sql_write",
							input: '{"query":"delete from notes"}',
							decision: null,
							isOpen: true,
						},
					},
				],
			},
			buttonName: "Approve",
			callback: "onDecideApproval",
		},
	])("sends $name, and drops it while a turn runs", ({
		message,
		buttonName,
		callback,
	}) => {
		const idle = renderPane({ messages: [message] });
		fireEvent.click(screen.getByRole("button", { name: buttonName }));
		expect(idle[callback]).toHaveBeenCalledOnce();
		cleanup();
		const busy = renderPane({ messages: [message], isSending: true });
		fireEvent.click(screen.getByRole("button", { name: buttonName }));
		expect(busy[callback]).not.toHaveBeenCalled();
	});

	it("locks the composer while the chat id is unknown", () => {
		renderPane({ isReady: false });
		const textarea = screen.getByRole("textbox");
		expect(textarea.hasAttribute("disabled")).toBe(true);
		expect(
			screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"),
		).toBe(true);
	});

	it("hides the raw thinking without the debug view, and shows the thought rows with it", () => {
		const reply: BuilderMessage = {
			id: "a1",
			role: "assistant",
			parts: [
				{
					type: "data-thought",
					data: {
						text: "Check the layout first.",
						seconds: 4,
						isStreaming: false,
					},
				},
				{ type: "text", text: "Here is the plan." },
			],
		};
		renderPane({ messages: [reply], showsAgentDebug: false });
		expect(screen.getByText("Here is the plan.")).toBeTruthy();
		expect(screen.queryByText(/Thought for/)).toBeNull();
		expect(screen.queryByText("Check the layout first.")).toBeNull();
		cleanup();
		renderPane({ messages: [reply], showsAgentDebug: true });
		fireEvent.click(screen.getByRole("button", { name: "Thought for 4s" }));
		expect(screen.getByText("Check the layout first.")).toBeTruthy();
	});

	it("shows the elapsed seconds in the working row only with the debug view", () => {
		renderPane({ isSending: true });
		expect(screen.getByRole("status").textContent).toBe(
			"Wandit is working…0.0s",
		);
		cleanup();
		renderPane({ isSending: true, showsAgentDebug: false });
		expect(screen.getByRole("status").textContent).toBe("Wandit is working…");
	});

	it.each<{ name: string; messages: BuilderMessage[] }>([
		{ name: "for the last reply", messages: [QUESTION_MESSAGE] },
		{
			// A rejected send keeps the user bubble after the reply, and no turn runs.
			name: "again after a rejected answer",
			messages: [
				QUESTION_MESSAGE,
				{
					id: "u2",
					role: "user",
					parts: [{ type: "text", text: "Warm and crafted" }],
				},
			],
		},
	])("opens the tray $name and sends the picked option as an answer", ({
		messages,
	}) => {
		const { onAnswerQuestions, onSend } = renderPane({ messages });
		fireEvent.click(screen.getByRole("button", { name: "Warm and crafted" }));
		fireEvent.click(screen.getByRole("button", { name: "Choose this option" }));
		expect(onAnswerQuestions).toHaveBeenCalledWith(
			expect.objectContaining({
				answers: [expect.objectContaining({ optionIds: ["warm"] })],
			}),
		);
		expect(onSend).not.toHaveBeenCalled();
	});

	it("answers a skipped question with the next plain message", () => {
		const { onAnswerQuestions, onSend } = renderPane({
			messages: [QUESTION_MESSAGE],
		});
		fireEvent.click(screen.getByRole("button", { name: "Skip the question" }));
		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Use green" } });
		fireEvent.keyDown(textarea, { key: "Enter" });
		expect(onSend).not.toHaveBeenCalled();
		expect(onAnswerQuestions).toHaveBeenCalledWith({
			message: "Use green",
			answers: [
				{
					toolCallId: "call-1",
					questionId: "question-0",
					action: "dismissed",
					optionIds: [],
					text: "Use green",
					files: [],
				},
			],
		});
	});

	it("follows new content at the end, stops after a scroll up, and jumps back on a send", () => {
		const { rerenderWith } = renderPane();
		const list = screen.getByText("Here is the plan.").closest(".scroll-warm");
		if (!(list instanceof HTMLElement)) throw new Error("no message list");
		// A browser fires a scroll event after the follow jump; jsdom does not.
		const resize = () => {
			act(() => {
				for (const run of resizeCallbacks) run();
			});
			fireEvent.scroll(list);
		};
		// At the end: 1000 - 600 - 400 = 0 px below the view.
		setListSize(list, 1000);
		list.scrollTop = 600;
		fireEvent.scroll(list);
		setListSize(list, 1200);
		resize();
		expect(list.scrollTop).toBe(1200);
		// An 80 px move up means the user reads; a resize keeps the place.
		list.scrollTop = 720;
		fireEvent.scroll(list);
		setListSize(list, 1400);
		resize();
		expect(list.scrollTop).toBe(720);
		// A send shows the new bubble at the end again.
		rerenderWith({ isSending: true });
		expect(list.scrollTop).toBe(1400);
	});
});
