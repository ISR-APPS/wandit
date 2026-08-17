import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { signChatIdentifier } from "./support.service";

describe("signChatIdentifier", () => {
	it("returns null when no HMAC token is configured", () => {
		expect(signChatIdentifier("user_1", undefined)).toBeNull();
	});

	it("returns the lowercase hex HMAC-SHA256 of the identifier", () => {
		const token = "test-hmac-token";
		const expected = createHmac("sha256", token).update("user_1").digest("hex");

		const hash = signChatIdentifier("user_1", token);

		expect(hash).toBe(expected);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("changes when the identifier changes", () => {
		const token = "secret";
		expect(signChatIdentifier("a", token)).not.toBe(
			signChatIdentifier("b", token),
		);
	});
});
