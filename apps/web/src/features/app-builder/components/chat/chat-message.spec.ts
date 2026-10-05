// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BuilderMessage } from "../../api/dto";
import { ChatMessageView } from "./chat-message";

// The page mounts one TooltipProvider; the message actions need it too.
function renderMessage(
	message: BuilderMessage,
	{
		trayQuestionKey = null,
		isDeveloperView = false,
		onRetry,
	}: {
		trayQuestionKey?: string | null;
		isDeveloperView?: boolean;
		onRetry?: () => void;
	} = {},
) {
	const onOpenActivity = vi.fn();
	const onDecideApproval = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			TooltipProvider,
			null,
			createElement(ChatMessageView, {
				message,
				isDeveloperView,
				onOpenActivity,
				onDecideApproval,
				trayQuestionKey,
				onRetry,
			}),
		),
	};
	render(createElement(I18nProvider, providerProps));
	return { onOpenActivity, onDecideApproval };
}

/** A finished reply: a thought, a step, a note, the summary, and the final answer. */
const FINISHED_MESSAGE: BuilderMessage = {
	id: "a3",
	role: "assistant",
	parts: [
		{
			type: "data-thought",
			data: { text: "Plan the page.", seconds: 4, isStreaming: false },
		},
		{
			type: "data-step",
			data: {
				kind: "edit",
				state: "done",
				target: "styles.css",
				description: null,
				detail: [],
				area: "styles",
				imageUrl: null,
			},
		},
		{ type: "data-note", data: { text: "Now the texts." } },
		{
			type: "data-summary",
			id: "summary-t3",
			data: {
				workedSeconds: 95,
				files: [
					{ path: "src/styles/global.css", insertions: 12, deletions: 3 },
					{ path: "src/routes/index.tsx", insertions: 4, deletions: 1 },
				],
			},
		},
		{ type: "text", text: "Done." },
	],
};

/** True when sonner added a toast with this title after the first `skip` history entries. */
function hasToastAfter(skip: number, title: string): boolean {
	return toast
		.getHistory()
		.slice(skip)
		.some((item) => "title" in item && item.title === title);
}

afterEach(cleanup);

describe("ChatMessageView", () => {
	it("renders every part inline in the developer view, with the thinking text and the changed files", () => {
		renderMessage(
			{
				...FINISHED_MESSAGE,
				parts: [
					...FINISHED_MESSAGE.parts.filter((part) => part.type !== "text"),
					{
						type: "data-question",
						id: "q1",
						data: {
							toolCallId: "call-1",
							questionId: "question-0",
							question: "Who scans?",
							kind: "single-choice",
							helper: null,
							maxFiles: null,
							options: [{ id: "desk", label: "Desk" }],
							isOpen: false,
							isAnswered: true,
						},
					},
				],
			},
			{ isDeveloperView: true },
		);
		expect(screen.getByText("Wandit")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Thought for 4s" }));
		expect(screen.getByText("Plan the page.")).toBeTruthy();
		expect(screen.getByText("Edited")).toBeTruthy();
		expect(screen.getByText("styles.css")).toBeTruthy();
		expect(screen.getByText("Now the texts.")).toBeTruthy();
		expect(screen.getByText("Worked for 2 min · 2 files changed")).toBeTruthy();
		expect(screen.getByText("index.tsx")).toBeTruthy();
		expect(screen.getByText("src/routes")).toBeTruthy();
		expect(screen.getByText("Who scans?")).toBeTruthy();
		expect(screen.getByText("Answered")).toBeTruthy();
		// No final text, so no Copy action; the summary is plain text, not a button.
		expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
		expect(screen.queryByRole("button", { name: /Worked for/ })).toBeNull();
	});

	it("shows the summary line and the final text, but no step and no note, in the production view", () => {
		const { onOpenActivity } = renderMessage(FINISHED_MESSAGE);
		expect(screen.getByText("Done.")).toBeTruthy();
		expect(screen.queryByText("Edited")).toBeNull();
		expect(screen.queryByText("styles.css")).toBeNull();
		expect(screen.queryByText(/Thought/)).toBeNull();
		expect(screen.queryByText("Now the texts.")).toBeNull();
		fireEvent.click(
			screen.getByRole("button", {
				name: "Worked for 2 min · 2 files changed",
			}),
		);
		expect(onOpenActivity).toHaveBeenCalledWith("a3");
	});

	it("groups the thought and step rows that follow each other in one block", () => {
		renderMessage(
			{
				id: "a2",
				role: "assistant",
				parts: [
					{
						type: "data-thought",
						data: { text: "", seconds: 2, isStreaming: false },
					},
					{
						type: "data-step",
						data: {
							kind: "run",
							state: "done",
							target: null,
							description: "Check the app",
							detail: [],
							area: null,
							imageUrl: null,
						},
					},
					{ type: "text", text: "Done." },
				],
			},
			{ isDeveloperView: true },
		);
		// The thought row is a Collapsible root; the step row is a plain row div.
		const thoughtRow = screen
			.getByText("Thought for 2s")
			.closest("[data-slot='collapsible']");
		const stepRow = screen.getByText("Check the app").parentElement;
		expect(thoughtRow?.parentElement).toBe(stepRow?.parentElement);
		// The text after the rows keeps the message gap: it is outside the feed block.
		expect(thoughtRow?.parentElement?.contains(screen.getByText("Done."))).toBe(
			false,
		);
	});

	it("points an open question at the tray only while the tray shows it", () => {
		const message: BuilderMessage = {
			id: "a3",
			role: "assistant",
			parts: [
				{
					type: "data-question",
					id: "call-1:question-0",
					data: {
						toolCallId: "call-1",
						questionId: "question-0",
						question: "Which style?",
						kind: "single-choice",
						helper: null,
						maxFiles: null,
						options: [{ id: "warm", label: "Warm" }],
						isOpen: true,
						isAnswered: false,
					},
				},
			],
		};
		renderMessage(message, { trayQuestionKey: "call-1:question-0" });
		expect(screen.getByText("Answer below")).toBeTruthy();
		expect(screen.queryByText("Answered")).toBeNull();
		cleanup();
		// After the skip X the tray hides, so no chip points at it.
		renderMessage(message);
		expect(screen.getByText("Which style?")).toBeTruthy();
		expect(screen.queryByText("Answer below")).toBeNull();
		expect(screen.queryByText("Answered")).toBeNull();
	});

	it("names a question the harness could not read", () => {
		renderMessage({
			id: "a4",
			role: "assistant",
			parts: [
				{
					type: "data-question",
					id: "call-1:question-0",
					data: {
						toolCallId: "call-1",
						questionId: "question-0",
						question: "",
						kind: "free-text",
						helper: null,
						maxFiles: null,
						options: [],
						isOpen: false,
						isAnswered: true,
					},
				},
			],
		});
		expect(screen.getByText("Wandit needs your answer")).toBeTruthy();
	});

	it("logs a clipboard failure and shows no copied toast", async () => {
		// jsdom has no navigator.clipboard, so the copy throws inside the try.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const seenToasts = toast.getHistory().length;
		renderMessage(FINISHED_MESSAGE);
		fireEvent.click(screen.getByRole("button", { name: "Copy" }));
		await waitFor(() => expect(errorSpy).toHaveBeenCalledOnce());
		expect(hasToastAfter(seenToasts, "Copied")).toBe(false);
		errorSpy.mockRestore();
	});

	it("writes the text parts to the clipboard and shows the copied toast", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
		const seenToasts = toast.getHistory().length;
		renderMessage(FINISHED_MESSAGE);
		fireEvent.click(screen.getByRole("button", { name: "Copy" }));
		await waitFor(() => expect(hasToastAfter(seenToasts, "Copied")).toBe(true));
		expect(writeText).toHaveBeenCalledWith("Done.");
		Reflect.deleteProperty(navigator, "clipboard");
	});

	it("renders the turn error as an alert with a Retry button", () => {
		const onRetry = vi.fn();
		renderMessage(
			{
				id: "a8",
				role: "assistant",
				parts: [
					{
						type: "data-error",
						id: "e1",
						data: {
							code: "SANDBOX_LOST",
							message: "The sandbox stopped.",
							retryable: true,
						},
					},
				],
			},
			{ onRetry },
		);
		const alert = screen.getByRole("alert");
		expect(alert.textContent).toContain(
			"The turn stopped: The sandbox stopped.",
		);
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("renders the receipt line with credits, tokens, the cache, and the model label", () => {
		renderMessage({
			id: "a9",
			role: "assistant",
			parts: [
				{
					type: "data-receipt",
					id: "r1",
					data: {
						credits: 2,
						modelId: "anthropic/claude-sonnet-5",
						inputTokens: 1000,
						outputTokens: 500,
						cacheReadTokens: 3000,
						cacheWriteTokens: 200,
					},
				},
			],
		});
		expect(
			screen.getByText(
				"2 credits · 1,500 tokens · cache: 3,000 read, 200 written · Claude Sonnet 5",
			),
		).toBeTruthy();
	});
});
