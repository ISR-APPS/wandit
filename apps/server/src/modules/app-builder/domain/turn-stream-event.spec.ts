import {
	builderTurnStatusSchema,
	createTurnRequestSchema,
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
});
