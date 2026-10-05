// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
	projectPromptMaxLength,
	type UploadAttachmentResponse,
} from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type TrayQuestion, useRequestTray } from "./use-request-tray";

function question(fields: Partial<TrayQuestion>): TrayQuestion {
	return {
		toolCallId: "call-1",
		questionId: "question-0",
		question: "Which style?",
		kind: "single-choice",
		helper: null,
		maxFiles: null,
		options: [
			{ id: "warm", label: "Warm" },
			{ id: "bold", label: "Bold" },
		],
		isOpen: true,
		isAnswered: false,
		...fields,
	};
}

const UPLOADED: UploadAttachmentResponse = {
	url: "https://pub.example/u/1/2/logo.png",
	key: "u/1/2/logo.png",
	mediaType: "image/png",
	filename: "logo.png",
	size: 1200,
};

function renderTray(
	questions: TrayQuestion[],
	options: {
		draft?: string;
		upload?: (file: File) => Promise<UploadAttachmentResponse>;
	} = {},
) {
	const onSubmit = vi.fn();
	const view = renderHook(
		(props: { draft: string; questions: TrayQuestion[] }) =>
			useRequestTray({
				questions: props.questions,
				draft: props.draft,
				onSubmit,
				upload: options.upload,
			}),
		{
			initialProps: { draft: options.draft ?? "", questions },
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(I18nProvider, {
					locale: "en",
					dictionary: fallbackDictionary,
					setLocale: () => {},
					children,
				}),
		},
	);
	return { ...view, onSubmit };
}

beforeEach(() => {
	// jsdom has no object URLs; the thumbnails only need a string.
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		value: () => "blob:thumb",
	});
	Object.defineProperty(URL, "revokeObjectURL", {
		configurable: true,
		value: () => {},
	});
});

afterEach(() => {
	cleanup();
	Reflect.deleteProperty(URL, "createObjectURL");
	Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("useRequestTray", () => {
	it("names a question the harness could not read", () => {
		const { result } = renderTray([
			question({ kind: "free-text", question: "", options: [] }),
		]);
		expect(result.current.state?.question).toBe("Wandit needs your answer");
	});

	it("shows nothing without an open question", () => {
		const { result } = renderTray([]);
		expect(result.current.state).toBeNull();
		expect(result.current.submit).toBeNull();
	});

	it("sends the picked option of a single choice with its label as the message", () => {
		const { result, onSubmit } = renderTray([question({})]);
		expect(result.current.state?.body).toEqual({
			kind: "single-choice",
			options: [
				{ id: "warm", label: "Warm" },
				{ id: "bold", label: "Bold" },
			],
			selectedId: null,
		});
		expect(result.current.submit).toMatchObject({
			label: "Choose an option",
			disabled: true,
		});
		act(() => result.current.bodyCallbacks.onPick("bold"));
		expect(result.current.submit).toMatchObject({
			label: "Choose this option",
			disabled: false,
		});
		act(() => result.current.submit?.onSubmit(""));
		expect(onSubmit).toHaveBeenCalledWith({
			message: "Bold",
			answers: [
				{
					toolCallId: "call-1",
					questionId: "question-0",
					action: "answered",
					optionIds: ["bold"],
					text: "",
					files: [],
				},
			],
		});
	});

	it("keeps the picks when a rejected send shows the same round again", () => {
		const questions = [question({})];
		const { result, rerender, onSubmit } = renderTray(questions);
		act(() => result.current.bodyCallbacks.onPick("warm"));
		act(() => result.current.submit?.onSubmit(""));
		// The running answer turn closes the questions.
		rerender({ draft: "", questions: [] });
		expect(result.current.state).toBeNull();
		// The API refused the send: the same question is open again.
		rerender({ draft: "", questions });
		expect(result.current.submit).toMatchObject({
			label: "Choose this option",
			disabled: false,
		});
		act(() => result.current.submit?.onSubmit(""));
		expect(onSubmit).toHaveBeenCalledTimes(2);
		expect(onSubmit.mock.calls[1]?.[0].answers[0].optionIds).toEqual(["warm"]);
	});

	it("cuts a long round summary to the message limit and keeps the full answers", () => {
		const longQuestion = "q".repeat(300);
		const longAnswer = "a".repeat(1900);
		const questions = [
			question({ question: longQuestion }),
			question({
				questionId: "question-1",
				kind: "free-text",
				question: longQuestion,
				options: [],
			}),
		];
		const { result, rerender, onSubmit } = renderTray(questions);
		act(() => result.current.bodyCallbacks.onPick("warm"));
		act(() => result.current.submit?.onSubmit(""));
		rerender({ draft: longAnswer, questions });
		act(() => result.current.submit?.onSubmit(longAnswer));
		const sent = onSubmit.mock.calls[0]?.[0];
		expect(sent.message.length).toBe(projectPromptMaxLength);
		expect(sent.answers[1].text).toBe(longAnswer);
	});

	it("shows world cards when the options carry a design world preview", () => {
		const card = {
			id: "zellige",
			name: "Zellige",
			tagline: "A courtyard.",
			preview: {
				ground: "#f4efe6",
				ink: "#1d1a16",
				accent: "#1f6f5c",
				fontFamily: "Fraunces",
				sampleWord: "Dar",
			},
		};
		const { result } = renderTray([
			question({ options: [{ id: "zellige", label: "Warm", card }] }),
		]);
		expect(result.current.state?.body.kind).toBe("world-pick");
	});

	it("lets typed text win over the chips and dims them", () => {
		const { result, onSubmit } = renderTray([question({})], {
			draft: "Something green",
		});
		expect(result.current.state?.typingOverride).toBe(true);
		expect(result.current.submit?.label).toBe("Answer");
		act(() => result.current.submit?.onSubmit("Something green"));
		expect(onSubmit.mock.calls[0]?.[0].answers[0]).toMatchObject({
			optionIds: [],
			text: "Something green",
		});
	});

	it("steps through a round and sends every answer in one call", () => {
		const questions = [
			question({ kind: "multi-select", question: "Which pages?" }),
			question({
				questionId: "question-1",
				kind: "free-text",
				question: "Your brand color?",
				options: [],
			}),
		];
		const { result, onSubmit, rerender } = renderTray(questions);
		expect(result.current.state?.step).toEqual({ current: 1, total: 2 });
		act(() => result.current.bodyCallbacks.onToggle("warm"));
		act(() => result.current.bodyCallbacks.onToggle("bold"));
		act(() => result.current.bodyCallbacks.onToggle("warm"));
		expect(result.current.submit?.label).toBe("Next");
		act(() => result.current.submit?.onSubmit(""));
		expect(result.current.state?.question).toBe("Your brand color?");
		expect(result.current.submit?.disabled).toBe(true);
		rerender({ draft: "Green", questions });
		expect(result.current.submit).toMatchObject({
			label: "Answer",
			disabled: false,
		});
		act(() => result.current.submit?.onSubmit("Green"));
		expect(onSubmit).toHaveBeenCalledWith({
			message: "Which pages?\nBold\n\nYour brand color?\nGreen",
			answers: [
				expect.objectContaining({ optionIds: ["bold"], text: "" }),
				expect.objectContaining({
					questionId: "question-1",
					optionIds: [],
					text: "Green",
				}),
			],
		});
	});

	it("uploads picked images and sends them as the answer files", async () => {
		const upload = vi.fn(async () => UPLOADED);
		const { result, onSubmit } = renderTray(
			[question({ kind: "attachments", options: [], maxFiles: 2 })],
			{ upload },
		);
		expect(result.current.state?.badge).toBe("media");
		act(() =>
			result.current.bodyCallbacks.onAddFiles([
				new File(["png"], "logo.png", { type: "image/png" }),
			]),
		);
		expect(result.current.submit?.disabled).toBe(true);
		await waitFor(() =>
			expect(result.current.submit?.label).toBe("Send 1 image"),
		);
		act(() => result.current.submit?.onSubmit(""));
		expect(onSubmit).toHaveBeenCalledWith({
			message: "1 image sent",
			answers: [
				expect.objectContaining({
					files: [
						{
							url: UPLOADED.url,
							mediaType: "image/png",
							filename: "logo.png",
						},
					],
				}),
			],
		});
	});

	it("refuses a file that is not an image without an upload", () => {
		const upload = vi.fn(async () => UPLOADED);
		const { result } = renderTray(
			[question({ kind: "attachments", options: [] })],
			{ upload },
		);
		act(() =>
			result.current.bodyCallbacks.onAddFiles([
				new File(["pdf"], "brief.pdf", { type: "application/pdf" }),
			]),
		);
		expect(upload).not.toHaveBeenCalled();
		const body = result.current.state?.body;
		expect(body?.kind === "media-drop" ? body.items[0]?.hasError : null).toBe(
			true,
		);
		expect(result.current.submit?.disabled).toBe(true);
	});

	it("marks a failed upload red and keeps the answer incomplete", async () => {
		const upload = vi.fn(async () => {
			throw new Error("network down");
		});
		const { result } = renderTray(
			[question({ kind: "attachments", options: [] })],
			{ upload },
		);
		act(() =>
			result.current.bodyCallbacks.onAddFiles([
				new File(["png"], "logo.png", { type: "image/png" }),
			]),
		);
		await waitFor(() => {
			const body = result.current.state?.body;
			expect(body?.kind === "media-drop" ? body.items[0]?.hasError : null).toBe(
				true,
			);
		});
		expect(result.current.submit?.disabled).toBe(true);
	});

	it("answers with Decide for me as a delegated answer", () => {
		const { result, onSubmit } = renderTray([question({})]);
		act(() => result.current.delegate());
		expect(onSubmit).toHaveBeenCalledWith({
			message: "Decide for me",
			answers: [
				expect.objectContaining({ action: "delegated", optionIds: [] }),
			],
		});
	});

	it("hides the tray on skip and answers the round with the next message", () => {
		const { result } = renderTray([question({})]);
		expect(result.current.dismissedAnswersFor("Use green")).toBeNull();
		act(() => result.current.dismiss());
		expect(result.current.state).toBeNull();
		expect(result.current.dismissedAnswersFor("Use green")).toEqual([
			{
				toolCallId: "call-1",
				questionId: "question-0",
				action: "dismissed",
				optionIds: [],
				text: "Use green",
				files: [],
			},
		]);
	});
});
