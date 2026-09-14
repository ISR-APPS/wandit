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
function renderMessage(message: BuilderMessage) {
	const onPreviewVersion = vi.fn();
	const onSendText = vi.fn();
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
			}),
		),
	};
	render(createElement(I18nProvider, providerProps));
	return { onPreviewVersion, onSendText };
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

	it("renders the byline, the trace, the tools, the question, the suggestion, and the diff", () => {
		renderMessage({
			id: "a1",
			role: "assistant",
			parts: [
				{
					type: "data-trace",
					id: "t1",
					data: {
						seconds: 4,
						steps: [{ label: "Read the brief", detail: "2 files" }],
					},
				},
				{
					type: "data-tools",
					id: "k1",
					data: {
						calls: [
							{ kind: "run", label: "Run migration", target: "pnpm db:push" },
						],
						files: [{ path: "src/db.ts", added: 3, removed: 1 }],
					},
				},
				{
					type: "data-question",
					id: "q1",
					data: { question: "Who scans?", options: ["Desk"], answer: "Desk" },
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
		expect(screen.getByText("1 tool call")).toBeTruthy();
		expect(screen.getByText("Who scans?")).toBeTruthy();
		expect(screen.getByText("Add a reminder?")).toBeTruthy();
		expect(screen.getByText("app/pass.tsx")).toBeTruthy();
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

	it("renders a progress card and no action row without a change", () => {
		renderMessage({
			id: "a4",
			role: "assistant",
			parts: [
				{
					type: "data-progress",
					id: "p4",
					data: {
						title: "Building QR pass",
						percent: 64,
						steps: [{ id: "s1", label: "Pass screen", state: "done" }],
					},
				},
			],
		});
		expect(screen.getByText("Building QR pass")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
	});
});
