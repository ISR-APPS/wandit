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
	trayQuestionKey: string | null = null,
) {
	const onPreviewVersion = vi.fn();
	const onSendText = vi.fn();
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
				onPreviewVersion,
				onSendText,
				onDecideApproval,
				trayQuestionKey,
			}),
		),
	};
	render(createElement(I18nProvider, providerProps));
	return { onPreviewVersion, onSendText, onDecideApproval };
}

const CHANGE_MESSAGE: BuilderMessage = {
	id: "a3",
	role: "assistant",
	parts: [
		{ type: "text", text: "Done." },
		{
			type: "data-change",
			id: "c3",
			data: { title: "Added sign-in and payments", versionNumber: 3 },
		},
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
	it("renders a user message as a bubble with its text", () => {
		renderMessage({
			id: "u1",
			role: "user",
			parts: [{ type: "text", text: "Build a membership app" }],
		});
		expect(screen.getByText("Build a membership app").className).toContain(
			"bg-bubble",
		);
	});

	it("renders the byline, the feed rows, the question, the suggestion, and the diff", () => {
		renderMessage({
			id: "a1",
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
					},
				},
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
				{
					type: "data-suggestion",
					id: "g1",
					data: {
						title: "Add a reminder?",
						body: "Send a push.",
						confidence: "high",
					},
				},
				{
					type: "data-diff",
					id: "d1",
					data: { path: "app/pass.tsx", lines: [{ kind: "add", text: "x" }] },
				},
			],
		});
		expect(screen.getByText("Wandit")).toBeTruthy();
		expect(screen.getByText("Thought for 4s")).toBeTruthy();
		expect(screen.getByText("Edited")).toBeTruthy();
		expect(screen.getByText("styles.css")).toBeTruthy();
		expect(screen.getByText("Who scans?")).toBeTruthy();
		expect(screen.getByText("Answered")).toBeTruthy();
		expect(screen.getByText("Add a reminder?")).toBeTruthy();
		expect(screen.getByText("app/pass.tsx")).toBeTruthy();
	});

	it("groups the thought and step rows that follow each other in one block", () => {
		renderMessage({
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
					},
				},
				{ type: "text", text: "Done." },
			],
		});
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
		renderMessage(message, "call-1:question-0");
		expect(screen.getByText("Answer below")).toBeTruthy();
		expect(screen.queryByText("Answered")).toBeNull();
		cleanup();
		// After the skip X the tray hides, so no chip points at it.
		renderMessage(message, null);
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

	it("sends an accepted suggestion body as text", () => {
		const { onSendText } = renderMessage({
			id: "a2",
			role: "assistant",
			parts: [
				{
					type: "data-suggestion",
					id: "g2",
					data: {
						title: "Add a reminder?",
						body: "Send a push.",
						confidence: "low",
					},
				},
			],
		});
		fireEvent.click(screen.getByRole("button", { name: "Accept" }));
		expect(onSendText).toHaveBeenCalledWith("Send a push.");
	});

	it("sends a follow-up prompt on click and hides the list without prompts", () => {
		const { onSendText } = renderMessage({
			id: "a5",
			role: "assistant",
			metadata: { followUps: ["Add a classes schedule"] },
			parts: [{ type: "text", text: "Done." }],
		});
		expect(screen.getByText("Follow-ups")).toBeTruthy();
		fireEvent.click(
			screen.getByRole("button", { name: "Add a classes schedule" }),
		);
		expect(onSendText).toHaveBeenCalledWith("Add a classes schedule");
		cleanup();
		renderMessage({
			id: "a6",
			role: "assistant",
			parts: [{ type: "text", text: "Done." }],
		});
		expect(screen.queryByText("Follow-ups")).toBeNull();
	});

	it("renders a change card and previews its version", () => {
		const { onPreviewVersion } = renderMessage(CHANGE_MESSAGE);
		expect(screen.getByText("Added sign-in and payments")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Preview" }));
		expect(onPreviewVersion).toHaveBeenCalledWith(3);
		expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
	});

	it("logs a clipboard failure and shows no copied toast", async () => {
		// jsdom has no navigator.clipboard, so the copy throws inside the try.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const seenToasts = toast.getHistory().length;
		renderMessage(CHANGE_MESSAGE);
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
		renderMessage(CHANGE_MESSAGE);
		fireEvent.click(screen.getByRole("button", { name: "Copy" }));
		await waitFor(() => expect(hasToastAfter(seenToasts, "Copied")).toBe(true));
		expect(writeText).toHaveBeenCalledWith("Done.");
		Reflect.deleteProperty(navigator, "clipboard");
	});

	it("sends an approval decision through onDecideApproval", () => {
		const { onDecideApproval } = renderMessage({
			id: "a7",
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
		});
		fireEvent.click(screen.getByRole("button", { name: "Approve" }));
		expect(onDecideApproval).toHaveBeenCalledWith("ap-1", true);
	});

	it("renders the turn error as an alert with the retry line", () => {
		renderMessage({
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
		});
		const alert = screen.getByRole("alert");
		expect(alert.textContent).toContain(
			"The turn stopped: The sandbox stopped.",
		);
		expect(alert.textContent).toContain("You can send the message again.");
	});

	it("renders the receipt line with credits, tokens, and the model label", () => {
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
					},
				},
			],
		});
		expect(
			screen.getByText("2 credits · 1,500 tokens · Claude Sonnet 5"),
		).toBeTruthy();
	});

	it("renders no action row without a change", () => {
		renderMessage({
			id: "a4",
			role: "assistant",
			parts: [{ type: "text", text: "Building the pass screen." }],
		});
		expect(screen.getByText("Building the pass screen.")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
	});
});
