import { getDictionary, locales } from "@wandit/internationalization";
import { describe, expect, it } from "vitest";

const PRODUCT_COPY_KEYS = [
	"active",
	"complete",
	"done",
	"failedBody",
	"failedTitle",
	"failedToStart",
	"prepared",
	"preparing",
	"publishing",
	"queueing",
	"ready",
] as const;

describe("product video translations", () => {
	it.each(
		locales,
	)("defines the complete product card copy in %s", async (locale) => {
		const dictionary = await getDictionary(locale);
		const copy = dictionary.workspace.chat.videoAttempt.product;

		expect(Object.keys(copy).sort()).toEqual([...PRODUCT_COPY_KEYS].sort());
		for (const key of PRODUCT_COPY_KEYS) {
			expect(copy[key].trim()).not.toBe("");
		}
	});
});
