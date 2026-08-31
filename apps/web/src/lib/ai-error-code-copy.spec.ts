import { getDictionary, locales } from "@wandit/internationalization";
import { describe, expect, it } from "vitest";

const SYNCHRONOUS_AI_CODES = [
	"AI_RATE_LIMITED",
	"AI_CAPACITY",
	"AI_TIMEOUT",
	"AI_CONTENT_MODERATED",
	"AI_INVALID_REQUEST",
	"AI_INTERNAL",
	"AI_UNKNOWN",
] as const;

describe("synchronous AI error-code copy", () => {
	it("is render-ready without interpolation in every locale", async () => {
		for (const locale of locales) {
			const dictionary = await getDictionary(locale);
			for (const code of SYNCHRONOUS_AI_CODES) {
				const message = dictionary.errors.codes[code];
				expect(message, `${locale}:${code}`).not.toMatch(/\{provider\}/);
			}
		}
	});
});
