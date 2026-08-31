// @ts-expect-error Vitest is provided by the workspace server test runner.
import { describe, expect, it } from "vitest";

import { scrubEvent } from "./shared";

const autoVercelAiEvent = () => ({
	exception: {
		values: [
			{
				mechanism: { type: "auto.vercelai.channel" },
			},
		],
	},
});

describe("scrubEvent", () => {
	it("drops a marked auto Vercel AI event", () => {
		const error = new Error("already captured");
		Reflect.set(error, Symbol.for("wandit.ai-error.captured"), true);

		expect(
			scrubEvent(autoVercelAiEvent(), { originalException: error }),
		).toBeNull();
	});

	it("keeps an unmarked auto Vercel AI event", () => {
		const event = autoVercelAiEvent();

		expect(
			scrubEvent(event, { originalException: new Error("not captured") }),
		).toBe(event);
	});

	it("removes cookies and sensitive headers from kept events", () => {
		const event = {
			request: {
				cookies: { session: "secret" },
				headers: {
					Accept: "application/json",
					Authorization: "Bearer secret",
					Cookie: "session=secret",
					"Set-Cookie": "session=secret",
					"X-API-Key": "secret",
				},
			},
		};

		expect(scrubEvent(event)).toBe(event);
		expect(event.request.cookies).toBeUndefined();
		expect(event.request.headers).toEqual({ Accept: "application/json" });
	});
});
