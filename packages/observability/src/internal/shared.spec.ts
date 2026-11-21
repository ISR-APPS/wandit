import { describe, expect, it } from "vitest";

import {
	redactPreviewSecrets,
	scrubEvent,
	stripEventUrlQueries,
	stripSpanUrlQueries,
} from "./shared";

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
				keys: [
					"rk_live_1",
					"safe",
					"push https://x-access-token:ghs_16C7e42F292c6912E7710c838347Ae178B4a@github.com/o/r.git failed",
				],
				nested: { role: "service_role token", url: "sb_secret_x" },
			},
			message: "plain message",
		};

		scrubEvent(event);

		expect(event.breadcrumbs[0]?.message).toBe("[Filtered]");
		expect(event.exception.values[0]?.value).toBe("[Filtered]");
		expect(event.extra.keys).toEqual(["[Filtered]", "safe", "[Filtered]"]);
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

describe("redactPreviewSecrets", () => {
	const PROJECT = "4b26e381-c37a-4f47-83e2-9d2b39036e08";
	it.each([
		[
			"a frame host URL",
			`https://f-abcdefghijklmnopqrstu--p-${PROJECT}.wanditpreview.app/login`,
			`https://f-redacted--p-${PROJECT}.wanditpreview.app/login`,
		],
		[
			"a phone host",
			`m-abcdefghijklmnopqrstu--p-${PROJECT}.wanditpreview.app`,
			`m-redacted--p-${PROJECT}.wanditpreview.app`,
		],
		[
			"a run host, which needs its cookie",
			`https://r-882ca69f29b0--p-${PROJECT}.wanditpreview.app/`,
			`https://r-882ca69f29b0--p-${PROJECT}.wanditpreview.app/`,
		],
	])("handles %s", (_name, input, expected) => {
		expect(redactPreviewSecrets(input)).toBe(expected);
	});
});

// Security: a query can hold a video billing token or an OAuth code.
describe("stripEventUrlQueries", () => {
	const TOKEN_URL =
		"https://api.wandit.test/api/v2/ai/v1/videos/callback?token=secret";

	it.each([
		["an error event", undefined],
		["a transaction event", "transaction"],
	])("removes every query of %s", (_name, type) => {
		const event = {
			type,
			request: { url: TOKEN_URL, query_string: "token=secret" },
			breadcrumbs: [
				{
					data: {
						url: "https://cdn.video.test/v.mp4",
						"http.query": "?sig=secret",
						"http.fragment": "#secret",
					},
				},
			],
		};

		const scrubbed = stripEventUrlQueries(event);

		expect(JSON.stringify(scrubbed)).not.toContain("secret");
		expect(scrubbed.request.url).toBe(
			"https://api.wandit.test/api/v2/ai/v1/videos/callback",
		);
	});

	it("keeps a URL with no query", () => {
		const url = "https://api.wandit.test/api/v2/ai/v1/videos";

		expect(stripEventUrlQueries({ request: { url } }).request.url).toBe(url);
	});
});

describe("stripSpanUrlQueries", () => {
	it("removes the query from http span data and the http span name", () => {
		const span = stripSpanUrlQueries({
			op: "http.client",
			description: "GET https://cdn.video.test/v.mp4?sig=secret",
			data: {
				"url.full": "https://cdn.video.test/v.mp4?sig=secret",
				"http.url": "https://cdn.video.test/v.mp4?sig=secret",
				"http.target": "/v.mp4?sig=secret",
				"url.query": "?sig=secret",
				"url.path": "/v.mp4",
			},
		});

		expect(JSON.stringify(span)).not.toContain("secret");
		expect(span.data["url.path"]).toBe("/v.mp4");
		expect(span.data["http.target"]).toBe("/v.mp4");
	});

	// A SQL span name holds `?` placeholders that are not a URL query.
	it("keeps the name of a span that is not http", () => {
		const description = "select * from users where id = ?";

		expect(stripSpanUrlQueries({ op: "db", description }).description).toBe(
			description,
		);
	});
});
