import { describe, expect, it } from "vitest";

import { chatHistoryQuerySchema } from "./chat-history";

describe("chatHistoryQuerySchema cursor", () => {
	// 16 digits can pass Number.MAX_SAFE_INTEGER and round to another seq.
	it.each([
		"abc",
		"12abc",
		"0",
		"-5",
		"1.5",
		"1e3",
		" 12",
		"0012",
		"1234567890123456",
	])("rejects %j, so the route answers 400", (cursor) => {
		expect(chatHistoryQuerySchema.safeParse({ cursor }).success).toBe(false);
	});

	it.each([
		{ cursor: "1", seq: 1 },
		{ cursor: "999999999999999", seq: 999_999_999_999_999 },
	])("accepts $cursor as the exact seq number", ({ cursor, seq }) => {
		expect(chatHistoryQuerySchema.parse({ cursor }).cursor).toBe(seq);
	});
});
