import {
	builderTurnStatusSchema,
	createTurnRequestSchema,
	harnessPendingInteractionSchema,
	resolveAskUserKind,
	turnDataPartSchema,
	turnQuestionDataSchema,
	turnStreamEventSchema,
	turnStreamPhases,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const CHAT_ID = "8d21a1c5-04f7-4e4e-9d8b-2d2d0b0e0a22";

describe("builderTurnStatusSchema", () => {
	it("parses all 13 builder turn statuses", () => {
		const statuses = [
			"queued",
			"waiting",
			"running",
			"cancelling",
			"waiting_for_answer",
			"waiting_for_approval",
			"succeeded",
			"failed",
			"canceled",
			"stalled",
			"stopped_no_credits",
			"stopped_project_cap",
			"stopped_disabled",
		];
		for (const status of statuses) {
			expect(builderTurnStatusSchema.parse(status)).toBe(status);
		}
	});

	it("rejects a 14th status", () => {
		expect(builderTurnStatusSchema.safeParse("archived").success).toBe(false);
	});
});

describe("turnStreamEventSchema", () => {
	it("parses a part event with any data payload", () => {
		const event = turnStreamEventSchema.parse({
			at: 1_700_000_000_000,
			data: { arbitrary: ["ai", "sdk", "chunk"] },
			id: "42",
			type: "part",
		});
		expect(event.type).toBe("part");
	});

	it("rejects a status event with an unknown phase", () => {
		expect(
			turnStreamEventSchema.safeParse({
				at: 1,
				data: { phase: "sleeping" },
				id: "1",
				type: "status",
			}).success,
		).toBe(false);
	});

	it("parses a status event with a known phase", () => {
		for (const phase of turnStreamPhases) {
			expect(
				turnStreamEventSchema.safeParse({
					at: 1,
					data: { phase },
					id: "1",
					type: "status",
				}).success,
			).toBe(true);
		}
	});
});

describe("createTurnRequestSchema", () => {
	it("rejects an empty message with no attachment", () => {
		expect(
			createTurnRequestSchema.safeParse({ chatId: CHAT_ID, message: "  " })
				.success,
		).toBe(false);
	});

	it("accepts an attachment-only body", () => {
		expect(
			createTurnRequestSchema.safeParse({
				attachments: [
					{
						mediaType: "image/png",
						url: "https://files.example.com/a.png",
					},
				],
				chatId: CHAT_ID,
				message: "",
			}).success,
		).toBe(true);
	});

	it("accepts a plain message", () => {
		expect(
			createTurnRequestSchema.safeParse({
				chatId: CHAT_ID,
				message: "Build the settings page",
			}).success,
		).toBe(true);
	});

	it("accepts an approval-only body", () => {
		expect(
			createTurnRequestSchema.safeParse({
				approval: { approvalId: "appr-1", approved: true },
				chatId: CHAT_ID,
				message: "",
			}).success,
		).toBe(true);
	});

	it("accepts an answers-only body", () => {
		expect(
			createTurnRequestSchema.safeParse({
				answers: [
					{
						action: "answered",
						files: [],
						optionIds: ["modern"],
						questionId: "question-0",
						text: "",
						toolCallId: "call-1",
					},
				],
				chatId: CHAT_ID,
				message: "",
			}).success,
		).toBe(true);
	});

	it("rejects an empty answers list as the only content", () => {
		expect(
			createTurnRequestSchema.safeParse({
				answers: [],
				chatId: CHAT_ID,
				message: "",
			}).success,
		).toBe(false);
	});
});

describe("resolveAskUserKind", () => {
	it("keeps an explicit kind", () => {
		expect(resolveAskUserKind({ kind: "attachments", options: [] })).toBe(
			"attachments",
		);
	});

	it("reads a question without options as free text", () => {
		expect(resolveAskUserKind({ options: [] })).toBe("free-text");
	});

	it("reads a question with options as a single choice", () => {
		expect(resolveAskUserKind({ options: [{ id: "a", label: "A" }] })).toBe(
			"single-choice",
		);
	});
});

describe("turnQuestionDataSchema", () => {
	it("reads a row stored with plain option labels", () => {
		const data = turnQuestionDataSchema.parse({
			answer: null,
			options: ["Blue", "Green"],
			question: "Which color?",
			questionId: "question-0",
			toolCallId: "call-1",
		});
		expect(data.kind).toBe("single-choice");
		expect(data.options).toEqual([
			{ id: "Blue", label: "Blue" },
			{ id: "Green", label: "Green" },
		]);
	});

	it("keeps option objects with a world card", () => {
		const card = {
			id: "zellige",
			name: "Zellige",
			tagline: "A courtyard you walk into.",
			preview: {
				accent: "#1f6f5c",
				fontFamily: "Fraunces",
				ground: "#f4efe6",
				ink: "#1d1a16",
				sampleWord: "Dar",
			},
		};
		const data = turnQuestionDataSchema.parse({
			answer: null,
			kind: "single-choice",
			options: [{ card, id: "zellige", label: "Warm and crafted" }],
			question: "Which style?",
			questionId: "question-0",
			toolCallId: "call-1",
		});
		expect(data.options[0]).toEqual({
			card,
			id: "zellige",
			label: "Warm and crafted",
		});
	});
});

describe("turnDataPartSchema", () => {
	it("parses a data-thought part", () => {
		const part = turnDataPartSchema.parse({
			data: { reasoningId: "r-1", seconds: 5 },
			id: "thought-r-1",
			type: "data-thought",
		});
		expect(part.type).toBe("data-thought");
	});
});

describe("harnessPendingInteractionSchema", () => {
	it("reads an envelope saved before ask_user as the built-in tool", () => {
		const interaction = harnessPendingInteractionSchema.parse({
			kind: "question",
			questions: [
				{
					id: "question-0",
					options: [{ id: "option-0", label: "Blue" }],
					question: "Which color?",
				},
			],
			toolCallId: "call-1",
		});
		expect(interaction).toMatchObject({
			questions: [{ kind: "single-choice" }],
			tool: "askUserQuestions",
		});
	});
});
