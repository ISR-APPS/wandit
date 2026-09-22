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

	it("masks the value field of a JSON body string and of a parsed body", () => {
		const stringBody = {
			request: { data: '{"value":"pa\\"ss","other":"keep"}' },
		};
		const objectBody = {
			request: { data: { other: "keep", value: "pass" } },
		};

		scrubEvent(stringBody);
		scrubEvent(objectBody);

		expect(stringBody.request.data).toBe(
			'{"value":"[Filtered]","other":"keep"}',
		);
		expect(objectBody.request.data).toEqual({
			other: "keep",
			value: "[Filtered]",
		});
	});

	it("replaces every string that holds a live-key prefix, at any depth", () => {
		const event = {
			breadcrumbs: [{ message: "key sk_live_abc used" }],
			exception: {
				values: [{ mechanism: { type: "generic" }, value: "whsec_123 bad" }],
			},
			extra: {
				keys: ["rk_live_1", "safe"],
				nested: { role: "service_role token", url: "sb_secret_x" },
			},
			message: "plain message",
		};

		scrubEvent(event);

		expect(event.breadcrumbs[0]?.message).toBe("[Filtered]");
		expect(event.exception.values[0]?.value).toBe("[Filtered]");
		expect(event.extra.keys).toEqual(["[Filtered]", "safe"]);
		expect(event.extra.nested).toEqual({
			role: "[Filtered]",
			url: "[Filtered]",
		});
		expect(event.message).toBe("plain message");
	});

	it("survives a cycle in the event data", () => {
		const body: { self?: object; token: string } = { token: "sk_live_1" };
		body.self = body;
		const event = { request: { data: body } };

		expect(scrubEvent(event)).toBe(event);
		expect(body.token).toBe("[Filtered]");
	});
});
