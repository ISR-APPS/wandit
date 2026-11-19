import { describe, expect, it } from "vitest";

import { webPageCacheKeyOf } from "./redis-web-page-cache";

describe("webPageCacheKeyOf", () => {
	it.each([
		{
			name: "another host case",
			other: "https://React.DEV/learn?page=1",
			isSameKey: true,
		},
		{
			name: "a fragment",
			other: "https://react.dev/learn?page=1#hooks",
			isSameKey: true,
		},
		{
			name: "another query",
			other: "https://react.dev/learn?page=2",
			isSameKey: false,
		},
	])("gives the same key for $name: $isSameKey", ({ isSameKey, other }) => {
		const key = webPageCacheKeyOf("https://react.dev/learn?page=1");

		expect(webPageCacheKeyOf(other) === key).toBe(isSameKey);
	});
});
