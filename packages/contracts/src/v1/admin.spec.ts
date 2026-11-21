import { describe, expect, it } from "vitest";
import { adminRecordTopupInputSchema } from "./admin";

describe("adminRecordTopupInputSchema currency", () => {
	// The offline stats group money by currency, so a code that is not 3 letters must not reach a receipt.
	it.each([
		[" DZD ", "dzd"],
		["usd", "usd"],
		["u5d", null],
		["$$$", null],
		["dz", null],
	])("%s parses to %s (null = rejected)", (currency, expected) => {
		const result = adminRecordTopupInputSchema.safeParse({
			userId: "user-1",
			amountMinor: 675_000,
			currency,
			method: "ccp",
			idempotencyKey: "6f1d2c1e-8a8b-4c2a-9a55-0c9d1b2e3f40",
		});
		expect(result.success ? result.data.currency : null).toBe(expected);
	});
});
