import { describe, expect, it } from "vitest";

import {
	askUserOutputOf,
	builtinQuestionResultOf,
	fallbackPromptOf,
	type QuestionInteraction,
	uploadCopyPath,
} from "./question-answers";

const UPLOAD_URL =
	"https://assets.test/uploads/user-1/0d1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b/logo.png";

/** The style choice of the call below; two design world options. */
const STYLE_QUESTION: QuestionInteraction["questions"][number] = {
	id: "question-0",
	kind: "single-choice",
	options: [
		{ id: "zellige", label: "Warm and crafted" },
		{ id: "beton", label: "Raw and bold" },
	],
	question: "Which style?",
};

/** One ask_user call: a style choice, then a logo upload. */
const INTERACTION: QuestionInteraction = {
	kind: "question",
	questions: [
		STYLE_QUESTION,
		{
			id: "question-1",
			kind: "attachments",
			options: [],
			question: "Your logo?",
		},
	],
	tool: "ask_user",
	toolCallId: "call-7",
};

const NO_FALLBACK = { attachments: [], message: "" };

describe("askUserOutputOf", () => {
	it("keeps known option ids of an answer and one pick for a single choice", () => {
		const output = askUserOutputOf(
			INTERACTION,
			[
				{
					action: "answered",
					files: [],
					optionIds: ["unknown", "beton", "zellige"],
					questionId: "question-0",
					text: "",
					toolCallId: "call-7",
				},
				{
					action: "answered",
					files: [{ mediaType: "image/png", url: UPLOAD_URL }],
					optionIds: [],
					questionId: "question-1",
					text: "Use the dark one",
					toolCallId: "call-7",
				},
			],
			NO_FALLBACK,
		);

		expect(output.answers).toEqual([
			{
				action: "answered",
				files: [],
				question: "Which style?",
				questionId: "question-0",
				selected: [{ id: "zellige", label: "Warm and crafted" }],
				text: "",
			},
			{
				action: "answered",
				files: [
					{
						filename: "logo.png",
						mediaType: "image/png",
						path: null,
						url: UPLOAD_URL,
					},
				],
				question: "Your logo?",
				questionId: "question-1",
				selected: [],
				text: "Use the dark one",
			},
		]);
	});

	it("keeps every known pick of a multi-select answer", () => {
		const multi: QuestionInteraction = {
			...INTERACTION,
			questions: [{ ...STYLE_QUESTION, kind: "multi-select" }],
		};

		const output = askUserOutputOf(
			multi,
			[
				{
					action: "answered",
					files: [],
					optionIds: ["beton", "zellige"],
					questionId: "question-0",
					text: "",
					toolCallId: "call-7",
				},
			],
			NO_FALLBACK,
		);

		expect(output.answers[0]?.selected.map((option) => option.id)).toEqual([
			"zellige",
			"beton",
		]);
	});

	it("skips a question the answers of the call leave out", () => {
		const output = askUserOutputOf(
			INTERACTION,
			[
				{
					action: "delegated",
					files: [],
					optionIds: [],
					questionId: "question-0",
					text: "",
					toolCallId: "call-7",
				},
			],
			{ attachments: [], message: "ignored text" },
		);

		expect(output.answers.map((answer) => answer.action)).toEqual([
			"delegated",
			"dismissed",
		]);
	});

	it("reads an exact label of the message as the pick of the first question", () => {
		const output = askUserOutputOf(INTERACTION, [], {
			attachments: [],
			message: "  raw and BOLD ",
		});

		expect(output.answers[0]).toMatchObject({
			action: "answered",
			selected: [{ id: "beton", label: "Raw and bold" }],
			text: "",
		});
		expect(output.answers[1]?.action).toBe("dismissed");
	});

	it("keeps other message text as the typed answer", () => {
		const output = askUserOutputOf(INTERACTION, [], {
			attachments: [],
			message: "Something calm",
		});

		expect(output.answers[0]).toMatchObject({
			action: "answered",
			selected: [],
			text: "Something calm",
		});
	});

	it("sends the attachments of an empty message as files", () => {
		const output = askUserOutputOf(INTERACTION, [], {
			attachments: [
				{ filename: "shop.jpg", mediaType: "image/jpeg", url: UPLOAD_URL },
			],
			message: "",
		});

		expect(output.answers[0]?.files).toEqual([
			{
				filename: "shop.jpg",
				mediaType: "image/jpeg",
				path: null,
				url: UPLOAD_URL,
			},
		]);
	});

	it("never picks a blank option for an empty message with a file", () => {
		const blank: QuestionInteraction = {
			...INTERACTION,
			questions: [
				{ ...STYLE_QUESTION, options: [{ id: "blank", label: " " }] },
			],
		};

		const output = askUserOutputOf(blank, [], {
			attachments: [{ mediaType: "image/png", url: UPLOAD_URL }],
			message: "",
		});

		expect(output.answers[0]).toMatchObject({
			action: "answered",
			files: [
				{
					filename: "logo.png",
					mediaType: "image/png",
					path: null,
					url: UPLOAD_URL,
				},
			],
			selected: [],
		});
	});

	it("skips the question when the user sent nothing", () => {
		const output = askUserOutputOf(INTERACTION, [], NO_FALLBACK);

		expect(output.answers[0]).toMatchObject({
			action: "dismissed",
			selected: [],
			text: "",
		});
	});
});

/** A built-in askUserQuestions call: a color choice, then a font question. */
const BUILTIN: QuestionInteraction = {
	kind: "question",
	questions: [
		{
			id: "question-1",
			kind: "single-choice",
			options: [
				{ id: "option-1", label: "Blue" },
				{ id: "option-2", label: "Green" },
			],
			question: "Which color?",
		},
		{
			id: "question-2",
			kind: "free-text",
			options: [],
			question: "Which font?",
		},
	],
	tool: "askUserQuestions",
	toolCallId: "call-1",
};

describe("builtinQuestionResultOf", () => {
	it("maps typed answers per question and reads a label as an option id", () => {
		const result = builtinQuestionResultOf(
			BUILTIN,
			[
				{
					action: "answered",
					files: [],
					optionIds: ["Green"],
					questionId: "question-1",
					text: "",
					toolCallId: "call-1",
				},
				{
					action: "answered",
					files: [],
					optionIds: [],
					questionId: "question-2",
					text: "Serif",
					toolCallId: "call-1",
				},
			],
			"Green\n\nSerif",
		);

		expect(result).toEqual({
			answers: {
				"question-1": { optionIds: ["option-2"] },
				"question-2": { freeform: "Serif", optionIds: [] },
			},
			partial: false,
			tool: "askUserQuestions",
			toolCallId: "call-1",
		});
	});

	it("tells a delegated question and leaves a skipped one out as partial", () => {
		const result = builtinQuestionResultOf(
			BUILTIN,
			[
				{
					action: "delegated",
					files: [],
					optionIds: [],
					questionId: "question-1",
					text: "",
					toolCallId: "call-1",
				},
				{
					action: "dismissed",
					files: [],
					optionIds: [],
					questionId: "question-2",
					text: "",
					toolCallId: "call-1",
				},
			],
			"",
		);

		expect(result?.answers).toEqual({
			"question-1": { freeform: "The user lets you decide.", optionIds: [] },
		});
		expect(result?.partial).toBe(true);
	});

	it("reads the message text for the first question without typed answers", () => {
		expect(builtinQuestionResultOf(BUILTIN, [], "green")).toEqual({
			answers: { "question-1": { optionIds: ["option-2"] } },
			partial: true,
			tool: "askUserQuestions",
			toolCallId: "call-1",
		});
		expect(builtinQuestionResultOf(BUILTIN, [], "teal")?.answers).toEqual({
			"question-1": { freeform: "teal", optionIds: [] },
		});
	});

	it("gives no result for a call without questions", () => {
		expect(
			builtinQuestionResultOf({ ...BUILTIN, questions: [] }, [], "green"),
		).toBeNull();
	});
});

describe("fallbackPromptOf", () => {
	it("gives one line per answer and per approval, in card order", () => {
		const prompt = fallbackPromptOf({
			approvals: [{ approvalId: "appr-1", approved: true }],
			messageText: "",
			pending: [
				INTERACTION,
				{
					approvalId: "appr-1",
					input: "{}",
					kind: "approval",
					toolCallId: "call-9",
					toolName: "run_sql_write",
				},
			],
			results: [
				{
					output: {
						answers: [
							{
								action: "answered",
								files: [
									{
										filename: "logo.png",
										mediaType: "image/png",
										path: "public/uploads/0d1f2a3b-logo.png",
										url: UPLOAD_URL,
									},
									{
										filename: "shop.jpg",
										mediaType: "image/jpeg",
										path: null,
										url: "https://assets.test/shop.jpg",
									},
								],
								question: "Which style?",
								questionId: "question-0",
								selected: [{ id: "beton", label: "Raw and bold" }],
								text: "darker",
							},
							{
								action: "dismissed",
								files: [],
								question: "Your logo?",
								questionId: "question-1",
								selected: [],
								text: "no logo yet",
							},
						],
					},
					tool: "ask_user",
					toolCallId: "call-7",
				},
			],
		});

		expect(prompt.split("\n")).toEqual([
			'Answer to your question "Which style?": Raw and bold; darker; public/uploads/0d1f2a3b-logo.png, https://assets.test/shop.jpg',
			'Answer to your question "Your logo?": skipped, then wrote: no logo yet',
			"The user approved the run_sql_write call. Continue.",
		]);
	});

	it("names a delegated answer and a skipped one without text", () => {
		const prompt = fallbackPromptOf({
			approvals: [],
			messageText: "",
			pending: [INTERACTION],
			results: [
				{
					output: {
						answers: [
							{
								action: "delegated",
								files: [],
								question: "Which style?",
								questionId: "question-0",
								selected: [],
								text: "",
							},
							{
								action: "dismissed",
								files: [],
								question: "Your logo?",
								questionId: "question-1",
								selected: [],
								text: "",
							},
						],
					},
					tool: "ask_user",
					toolCallId: "call-7",
				},
			],
		});

		expect(prompt.split("\n")).toEqual([
			'Answer to your question "Which style?": the user lets you decide.',
			'Answer to your question "Your logo?": skipped.',
		]);
	});

	it("answers a built-in question card with the message text", () => {
		const prompt = fallbackPromptOf({
			approvals: [],
			messageText: "green",
			pending: [
				{
					kind: "question",
					questions: [
						{
							id: "question-1",
							kind: "single-choice",
							options: [],
							question: "Which color?",
						},
					],
					tool: "askUserQuestions",
					toolCallId: "call-1",
				},
			],
			results: [],
		});

		expect(prompt).toBe('Answer to your question "Which color?": green');
	});
});

describe("uploadCopyPath", () => {
	it("names the copy with the uuid prefix and the upload file name", () => {
		expect(uploadCopyPath(UPLOAD_URL)).toBe("public/uploads/0d1f2a3b-logo.png");
	});

	it("refuses a file name that is not a sanitized upload name", () => {
		expect(
			uploadCopyPath("https://assets.test/uploads/user-1/0d1f2a3b-4c5d/.env"),
		).toBeNull();
		expect(
			uploadCopyPath("https://assets.test/uploads/user-1/0d1f2a3b-4c5d/%2E%2E"),
		).toBeNull();
	});

	it("refuses a URL without a uuid segment", () => {
		expect(uploadCopyPath("https://assets.test/logo.png")).toBeNull();
	});
});
