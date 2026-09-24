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
	const onCancel = vi.fn();
	const onCollapse = vi.fn();
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
					focusLabel: null,
					isSending: false,
					phase: null,
					isReady: true,
					projectName: "Nadi Fitness",
					onSend,
					onDecideApproval,
					onAnswerQuestions,
					onCancel,
					errorText: null,
					onCollapse,
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
		onCancel,
		onCollapse,
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

	it("sends an approval decision, and drops it while a turn runs", () => {
		const approvalMessage: BuilderMessage = {
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
		};
		const idle = renderPane({ messages: [approvalMessage] });
		fireEvent.click(screen.getByRole("button", { name: "Approve" }));
		expect(idle.onDecideApproval).toHaveBeenCalledWith("ap-1", true);
		cleanup();
		const busy = renderPane({
			messages: [approvalMessage],
			isSending: true,
		});
		fireEvent.click(screen.getByRole("button", { name: "Approve" }));
		expect(busy.onDecideApproval).not.toHaveBeenCalled();
	});

	it("shows the project name in the header and hides the chat from its button", () => {
		const { onCollapse } = renderPane();
		expect(screen.getByText(/Nadi Fitness/)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Hide the chat" }));
		expect(onCollapse).toHaveBeenCalledOnce();
	});

	it("locks the composer while the chat id is unknown", () => {
		renderPane({ isReady: false });
		const textarea = screen.getByRole("textbox");
		expect(textarea.hasAttribute("disabled")).toBe(true);
		expect(
			screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"),
		).toBe(true);
	});

	it("shows the Stop button only while a turn runs, and it calls onCancel", () => {
		const onCancel = vi.fn();
		renderPane({ onCancel });
		expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
		cleanup();
		renderPane({ onCancel, isSending: true });
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("shows the error sentence in an alert row when errorText is set", () => {
		renderPane();
		expect(screen.queryByRole("alert")).toBeNull();
		cleanup();
		renderPane({ errorText: "You have no credits left for this turn." });
		expect(screen.getByRole("alert").textContent).toBe(
			"You have no credits left for this turn.",
		);
	});

	it("names the live phase in the working row", () => {
		renderPane({ isSending: true, phase: "sandbox_waking" });
		expect(screen.getByRole("status").textContent).toContain(
			"Waking up your workspace",
		);
	});

	it("opens the tray on the composer and sends the picked option as an answer", () => {
		const { onAnswerQuestions, onSend } = renderPane({
			messages: [QUESTION_MESSAGE],
		});
		// The thread keeps a receipt line; the tray repeats the question above the composer.
		expect(screen.getAllByText("Which style fits your shop?")).toHaveLength(2);
		expect(screen.getByText("Answer below")).toBeTruthy();
		const answer = screen.getByRole("button", { name: "Choose an option" });
		expect(answer.hasAttribute("disabled")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Warm and crafted" }));
		fireEvent.click(screen.getByRole("button", { name: "Choose this option" }));
		expect(onAnswerQuestions).toHaveBeenCalledWith({
			message: "Warm and crafted",
			answers: [
				{
					toolCallId: "call-1",
					questionId: "question-0",
					action: "answered",
					optionIds: ["warm"],
					text: "",
					files: [],
				},
			],
		});
		expect(onSend).not.toHaveBeenCalled();
	});

	it("shows the tray again after a rejected answer, so the same answer can go again", () => {
		// A rejected send keeps the user bubble after the reply, and no turn runs.
		const { onAnswerQuestions } = renderPane({
			messages: [
				QUESTION_MESSAGE,
				{
					id: "u2",
					role: "user",
					parts: [{ type: "text", text: "Warm and crafted" }],
				},
			],
		});
		fireEvent.click(screen.getByRole("button", { name: "Warm and crafted" }));
		fireEvent.click(screen.getByRole("button", { name: "Choose this option" }));
		expect(onAnswerQuestions).toHaveBeenCalledWith(
			expect.objectContaining({
				answers: [expect.objectContaining({ optionIds: ["warm"] })],
			}),
		);
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
