import { describe, expect, it } from "vitest";

import { toInbound } from "./llm-proxy.controller";

const signal = new AbortController().signal;

describe("toInbound", () => {
	it("keeps a '?' inside a query value and cuts only at the first one", () => {
		const inbound = toInbound(
			{
				headers: { "anthropic-version": "2023-06-01" },
				rawBody: Buffer.from("{}"),
				raw: { url: "/v2/llm/v1/messages?beta=true&x=a?b" },
			},
			"messages",
			signal,
		);

		expect(inbound.queryString).toBe("beta=true&x=a?b");
		expect(inbound.anthropicVersion).toBe("2023-06-01");
		expect(inbound.body.toString()).toBe("{}");
	});

	it("gives no query string for a plain url and an empty body without rawBody", () => {
		const inbound = toInbound(
			{ headers: {}, rawBody: undefined, raw: { url: "/v2/llm/v1/messages" } },
			"count_tokens",
			signal,
		);

		expect(inbound.queryString).toBeUndefined();
		expect(inbound.endpoint).toBe("count_tokens");
		expect(inbound.body.length).toBe(0);
	});
});
